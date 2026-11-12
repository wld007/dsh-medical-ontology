/**
 * O3 决策节点（工序6 设计 v1.1）：在每条问题线上找出医生“做了决定”的时刻。
 * 治疗改变＋关键流程成点；维持只在有新情况时成点；转述、出院记录、收费只作佐证；
 * 同次就诊×同一条线合成一个点；落在存疑区间的保留但不进正式题。不补、不替医生写理由。
 */
import { stableId } from '../ids.js'
import { addDays, day, diffDays, eventDay, labReading, mentionDay } from './util.js'

function sourceRole(m, sources) {
  return sources.find((s) => (s.recordType === '*' || s.recordType === m.recordType) && (s.section === '*' || s.section === m.section))?.role ?? '上下文'
}

/** 动作：启动／停止／调整／计划新开／计划继续／维持；关键流程：收治／留观／转诊会诊／告病危 */
function classify(m, ev, re) {
  const text = m.text.replace(/^\d+[、.．]\s*/, '')
  if (re.refuse.test(text) && /拒绝|自行/.test(m.item ?? m.subclass ?? '')) return { part: '患者方决定', action: '拒绝' }
  if (m.item === '拒绝' || m.item === '自行') return { part: '患者方决定', action: m.item }
  if (['检查检验', '复查与随访'].includes(m.item)) return { part: '同时安排', action: '安排' }
  if (['收治／留观／出院', '收治／会诊／转诊', '病情告知'].includes(m.item) || ev?.conceptGroup === '诊疗流程') {
    if (re.admit.test(text)) return { part: '关键流程', action: '收治' }
    if (re.observe.test(text)) return { part: '关键流程', action: '留观' }
    if (re.critical.test(text)) return { part: '关键流程', action: '告病危' }
    if (re.refer.test(text)) return { part: '同时安排', action: '转诊随诊' }
    return { part: '同时安排', action: '安排' }
  }
  if (m.recordType === '手术记录') return { part: '治疗', action: '启动' }
  if (re.stop.test(text) || m.action === '停止') return { part: '治疗', action: '停止' }
  if (re.adjust.test(text) || m.action === '调整') return { part: '治疗', action: /改用|改为|换用/.test(text) ? '更换' : '调整' }
  if (re.continue.test(text) || /维持/.test(m.action ?? '')) return { part: '治疗', action: '维持' }
  if (re.start.test(text) || /启动|计划/.test(m.action ?? '')) return { part: '治疗', action: m.action === '计划' ? '计划' : '启动' }
  return null // 没有动作写法（如“摄片示…”被上游归成治疗）
}

const ACTION_TYPE = { 启动: '启动或更换方案', 更换: '启动或更换方案', 计划新开: '启动或更换方案', 调整: '调整原方案', 停止: '停止或转支持', 维持: '继续原方案', 计划继续: '继续原方案', 收治: '转科转院', 留观: '转科转院', 告病危: '处理合并症或不良反应' }

export function buildDecisions(input, rules, problems) {
  const { re, params: P, specialty: spec, general } = rules
  const mentionsById = new Map(input.mentions.map((m) => [m.id, m]))
  const eventsById = new Map(input.events.map((e) => [e.id, e]))
  const linesById = new Map(problems.lines.map((l) => [l.id, l]))
  const encById = new Map(input.encounters.map((e) => [e.id, e]))
  const eventLines = new Map() // eventId → [{line, primary}]
  const problemsPrimary = new Map() // eventId → 主线所在的线
  for (const m of problems.members) {
    if (!eventLines.has(m.event)) eventLines.set(m.event, [])
    eventLines.get(m.event).push(linesById.get(m.problem))
    if (m.primary && !problemsPrimary.has(m.event)) problemsPrimary.set(m.event, m.problem)
  }

  const lineFor = (m, ev) => {
    const ls = (ev && eventLines.get(ev.id)) || []
    const d = mentionDay(m)
    // 同时挂长期线和发作线的，归更具体的发作线（且时刻在发作窗口内）
    const ep = ls.find((l) => !['长期问题', '从属子线'].includes(l.kind) && d >= addDays(l.start, -P.episodeSlackDays) && d <= addDays(l.end, P.episodeSlackDays))
    if (ep) return ep
    const primary = ev ? problemsPrimary.get(ev.id) : null
    const lt = ls.find((l) => ['长期问题', '从属子线'].includes(l.kind) && l.id === primary) ?? ls.find((l) => ['长期问题', '从属子线'].includes(l.kind))
    if (lt) return lt
    // 关键流程：按原文诊断名找线
    for (const [word, code] of spec.flowLines) {
      if (!m.text.includes(word)) continue
      const cands = problems.lines.filter((l) => l.code === code)
      const hit = cands.find((l) => !['长期问题', '从属子线'].includes(l.kind) && d >= addDays(l.start, -P.episodeSlackDays) && d <= addDays(l.end, P.episodeSlackDays)) ?? cands.find((l) => ['长期问题', '从属子线'].includes(l.kind))
      if (hit) return hit
    }
    return null
  }

  // 同一概念此前是否有记载（计划继续／计划新开）
  const conceptDays = new Map()
  for (const e of input.events) if (e.concept) { if (!conceptDays.has(e.concept)) conceptDays.set(e.concept, []); conceptDays.get(e.concept).push(...e.mentions.map((id) => mentionsById.get(id)).filter(Boolean).map(mentionDay)) }
  const seenBefore = (concept, d) => (conceptDays.get(concept) ?? []).some((x) => x < d && diffDays(x, d) <= P.planLookbackDays)

  const actions = []; const extras = []; const corroborations = []; const excluded = []
  for (const m of input.mentions) {
    if (m.type !== '决策') continue
    const ev = eventsById.get(m.eventId)
    if (m.templated) { excluded.push({ mention: m.id, text: m.text, reason: `模板化（${m.templated}）` }); continue }
    const role = sourceRole(m, general.sources)
    // 上游细项偶有误归（如“予头孢地尼…”归成宣教）：对象是药物/透析/手术的按治疗处理
    const go = ['用药', '透析', '手术操作'].includes(ev?.conceptGroup) ? '治疗' : (general.items[m.item] ?? '治疗')
    if (go === '不进') continue
    if (role === '上下文') { excluded.push({ mention: m.id, text: m.text, reason: `来源只作上下文（${m.recordType}／${m.section}）` }); continue }
    const text = m.text.replace(/^\d+[、.．]\s*/, '')
    if (role === '佐证') { corroborations.push({ mention: m, ev }); continue }
    if (role === '动作（仅当次）' && (!re.currentAct.test(text) || re.notCurrent.test(text) || re.inUse.test(text))) {
      excluded.push({ mention: m.id, text: m.text, reason: re.inUse.test(text) ? '在用状态口吻，作上下文' : '不是当次写法（门诊现病史只认“今予／予以／停／改用”）' }); continue
    }
    const c = classify(m, ev, re)
    if (!c) { excluded.push({ mention: m.id, text: m.text, reason: '没有动作写法' }); continue }
    if (go === '治疗' && c.part === '同时安排') c.part = '治疗'
    if (role === '动作（仅近期）') {
      const recent = diffDays(mentionDay(m), day(m.writtenAt)) <= P.contemporaryDays
      if (c.part !== '关键流程' && (!recent || m.temporality === '回顾转述')) { excluded.push({ mention: m.id, text: m.text, reason: '入院记录里早于写成 7 天以上，视为转述' }); continue }
    }
    if (re.generic.test(text) && c.part === '治疗') { excluded.push({ mention: m.id, text: m.text, reason: '泛化处理，不成点' }); continue }
    let action = c.action
    if (action === '计划') action = ev?.concept && seenBefore(ev.concept, mentionDay(m)) ? '计划继续' : '计划新开'
    if (ev?.concept && spec.routineMaintenance.includes(ev.concept) && !['停止', '调整', '更换'].includes(action)) action = '维持'
    const row = { mention: m, ev, part: c.part, action, line: lineFor(m, ev) }
    if (c.part === '治疗' || c.part === '关键流程') actions.push(row); else extras.push(row)
  }

  // 新情况：回看 30 天，本线首次出现的诊断，或检验由正常（或从未查）转为超出参考区间
  const labs = input.events.filter((e) => e.conceptGroup === '检验结果' && e.concept).map((e) => ({ e, d: eventDay(e), ...labReading(e, mentionsById) })).sort((a, b) => a.d.localeCompare(b.d))
  const memberSet = new Map()
  for (const mm of problems.members) { if (!memberSet.has(mm.problem)) memberSet.set(mm.problem, new Set()); memberSet.get(mm.problem).add(mm.event) }
  function newSituations(line, d) {
    if (!line) return []
    const set = memberSet.get(line.id) ?? new Set()
    const lo = addDays(d, -P.newSituationDays)
    const out = []
    for (const id of set) {
      const e = eventsById.get(id)
      if (e.conceptGroup !== '诊断' || e.polarity === '阴性') continue
      const first = day(e.firstWritten)
      if (first >= lo && first <= d) out.push({ kind: '新诊断', text: e.concept, day: first, event: e.id, mention: e.firstMention })
    }
    for (const x of labs) {
      if (!set.has(x.e.id) || !x.flag || x.d < lo || x.d > d) continue
      const prev = labs.filter((y) => y.e.concept === x.e.concept && y.d < x.d).at(-1)
      if (!prev || !prev.flag) out.push({ kind: '检验异常', text: `${x.e.concept} ${x.v ?? ''}${x.flag}`, day: x.d, event: x.e.id, mention: x.mention })
    }
    return out.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 12)
  }

  // 合并：同一次就诊（同一次真实住院，或同一天）× 同一条线
  const encKey = (m) => {
    const enc = m.encounterId ? encById.get(m.encounterId) : null
    return enc && enc.kind === '住院' ? enc.id : `${m.encounterId ?? ''}@${mentionDay(m)}`
  }
  // 收治的时刻取所属住院的入院时间（入院记录现病史里的“拟…收住入院”常继承到前句的“2天前”）
  for (const a of actions) {
    const enc = a.mention.encounterId ? encById.get(a.mention.encounterId) : null
    a.at = a.action === '收治' && enc?.kind === '住院' && enc.start ? day(enc.start) : mentionDay(a.mention)
  }
  // 没挂上线的关键流程：先按原文诊断名（lineFor 已做），再看同一文书里其他动作所在的线
  for (const a of actions) {
    if (a.line) continue
    const sib = actions.find((b) => b !== a && b.line && b.mention.fragmentId === a.mention.fragmentId)
    if (sib) { a.line = sib.line; a.lineBy = '同文书动作所在线' }
  }
  const points = new Map()
  for (const a of actions) {
    const k = `${a.line?.id ?? '就诊层面'}|${encKey(a.mention)}`
    if (!points.has(k)) points.set(k, { key: k, line: a.line, enc: a.mention.encounterId, actions: [], extras: [] })
    points.get(k).actions.push(a)
  }
  // 同时安排、患者方决定：挂到同一文书里的决策点（同一片段优先，其次同次就诊）
  for (const x of extras) {
    const cands = [...points.values()].filter((p) => p.actions.some((a) => a.mention.fragmentId === x.mention.fragmentId))
    const sameEnc = cands.length ? cands : [...points.values()].filter((p) => p.key.endsWith(`|${encKey(x.mention)}`))
    const target = (x.part === '患者方决定' ? sameEnc.filter((p) => p.actions.some((a) => a.mention.s < x.mention.s)).at(-1) : null) ?? sameEnc.find((p) => p.line && x.line && p.line.id === x.line.id) ?? sameEnc[0]
    if (target) target.extras.push(x)
  }

  const out = []
  for (const p of points.values()) {
    const ms = p.actions.map((a) => a.mention)
    const decidedAt = p.actions.map((a) => a.at).sort()[0]
    const visibleAt = ms.map((m) => m.writtenAt).sort()[0]
    const news = newSituations(p.line, decidedAt)
    const treat = p.actions.filter((a) => a.part === '治疗')
    const changes = treat.filter((a) => !['维持', '计划继续'].includes(a.action))
    const flows = p.actions.filter((a) => a.part === '关键流程')
    let pointKind = changes.length ? '治疗改变' : flows.length ? '关键流程' : news.length ? '有新情况的维持' : null
    if (!pointKind) { for (const a of p.actions) excluded.push({ mention: a.mention.id, text: a.mention.text, reason: '维持且近期无新情况，不成点' }); continue }
    const actionConcepts = [...new Set(p.actions.map((a) => a.ev?.concept ?? a.mention.text))].sort()
    const id = stableId('D', p.line?.id ?? '就诊层面', p.key.split('|')[1], ...actionConcepts)
    // 写明的理由：同一文书里的推理判断原文
    const frags = new Set(ms.map((m) => m.fragmentId))
    const reasons = input.mentions.filter((m) => frags.has(m.fragmentId) && m.type === '判断' && /推理/.test(m.subdivision ?? '') && !m.templated)
    // 佐证：决策后 30 天内同概念的转述或执行记录
    const corr = corroborations.filter((c) => c.ev?.concept && actionConcepts.includes(c.ev.concept) && mentionDay(c.mention) >= decidedAt && diffDays(decidedAt, mentionDay(c.mention)) <= P.corroborateDays)
    for (const c of corr) c.used = true
    const doubt = (p.line?.doubtful ?? []).find((iv) => decidedAt >= iv.from && decidedAt <= iv.to && iv.concepts.some((cn) => actionConcepts.includes(cn)))
    const unknown = p.actions.some((a) => !a.ev?.concept)
    const notFormal = [doubt ? '落在存疑区间' : null, unknown ? '对象不明' : null, !p.line ? '未归线程（就诊层面）' : null].filter(Boolean)
    const enc = p.enc ? encById.get(p.enc) : null
    out.push({
      id, problem: p.line?.id ?? null, problemCode: p.line?.code ?? null, problemName: p.line?.label ?? '就诊层面',
      isMainLine: Boolean(p.line?.isMainLine),
      nodeKind: flows.length && !changes.length ? '关键流程' : '治疗节点', pointKind,
      encounter: p.enc ?? null, encounterKind: enc?.kind ?? null,
      decidedAt, visibleAt, backfilled: decidedAt !== day(visibleAt),
      actions: p.actions.map((a) => ({ action: a.action, part: a.part, type: ACTION_TYPE[a.action] ?? '处理合并症或不良反应', object: a.ev?.concept ?? null, mention: a.mention.id, text: a.mention.text, recordType: a.mention.recordType, section: a.mention.section, writtenAt: a.mention.writtenAt, occurAt: a.at, rule: `O3-${sourceRole(a.mention, general.sources)}${a.lineBy ? `；找线：${a.lineBy}` : ''}` })),
      scheduled: p.extras.filter((x) => x.part === '同时安排').map((x) => ({ text: x.mention.text, mention: x.mention.id, object: x.ev?.concept ?? null })),
      patientChoices: p.extras.filter((x) => x.part === '患者方决定').map((x) => ({ text: x.mention.text, mention: x.mention.id, action: x.action })),
      indication: { newSituations: news, reasons: reasons.map((m) => ({ text: m.text, mention: m.id })) },
      execution: { corroborations: corr.map((c) => ({ text: c.mention.text, mention: c.mention.id, recordType: c.mention.recordType, writtenAt: c.mention.writtenAt })), firstExecuted: corr.map((c) => mentionDay(c.mention)).sort()[0] ?? null },
      nonClinical: p.extras.filter((x) => x.part === '患者方决定').map((x) => ({ kind: '病人拒绝', text: x.mention.text, mention: x.mention.id })),
      doubtful: doubt ? { finding: doubt.finding, verdict: doubt.verdict } : null,
      formal: notFormal.length === 0, notFormalReasons: notFormal,
      basis: [...ms.map((m) => m.id), ...p.extras.map((x) => x.mention.id)],
    })
  }
  out.sort((a, b) => a.decidedAt.localeCompare(b.decidedAt) || String(a.problemCode).localeCompare(String(b.problemCode)))
  const reportedOnly = corroborations.filter((c) => !c.used && c.ev?.concept).map((c) => ({ concept: c.ev.concept, text: c.mention.text, mention: c.mention.id, recordType: c.mention.recordType, writtenAt: c.mention.writtenAt }))
  return { decisions: out, excluded, reportedOnly }
}
