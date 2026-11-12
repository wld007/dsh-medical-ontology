/**
 * O4–O8 本体组装（v0.1 只做规则能做的部分）：
 *   治：三窗口结局（指标方向、新诊断、住院）、到下一个同线／主线节点的间隔、后续调整
 *   诊：诊断清单、角色候选、确定程度历史；疾病关系只收原文命名能说明的从属
 *   归：同窗口其他线上的决策列为混杂候选（结构推出，份额待模型＋医生）
 *   人：人口学、患者意愿（拒绝）、末次接触
 * 规则推不出的（伴发事件、归因份额、原因类别）留空并标“待模型／医生”，不编造。
 */
import { stableId } from '../ids.js'
import { addDays, common, day, diffDays, eventDay, labReading, maxDay, minDay } from './util.js'

const WINDOWS = [['d0_90', 0, 90], ['d91_180', 91, 180], ['d180_plus', 181, Infinity]]

export function assemble(input, rules, problems, decided) {
  const P = rules.params; const spec = rules.specialty
  const mentionsById = new Map(input.mentions.map((m) => [m.id, m]))
  const eventsById = new Map(input.events.map((e) => [e.id, e]))
  const linesById = new Map(problems.lines.map((l) => [l.id, l]))
  const lastContact = maxDay(input.mentions.map((m) => m.writtenAt))
  const decisions = decided.decisions

  // 检验序列（按归一概念）
  const series = new Map()
  for (const e of input.events) {
    if (e.conceptGroup !== '检验结果' || !e.concept) continue
    const r = labReading(e, mentionsById)
    if (r.v == null) continue
    if (!series.has(e.concept)) series.set(e.concept, [])
    series.get(e.concept).push({ d: eventDay(e), v: r.v, flag: r.flag, event: e.id, mention: r.mention })
  }
  for (const s of series.values()) s.sort((a, b) => a.d.localeCompare(b.d))
  const stays = input.encounters.filter((x) => x.kind === '住院' && x.start).map((x) => ({ id: x.id, start: day(x.start), end: day(x.end), dept: x.dept }))
  const dxEvents = input.events.filter((e) => e.conceptGroup === '诊断' && e.concept && e.polarity !== '阴性')
  const memberOf = new Map()
  for (const m of problems.members) { if (!memberOf.has(m.problem)) memberOf.set(m.problem, new Set()); memberOf.get(m.problem).add(m.event) }

  // ── 治：结局与衔接
  const byLine = new Map()
  for (const d of decisions) { const k = d.problem ?? '就诊层面'; if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(d) }
  const mains = decisions.filter((d) => d.isMainLine)
  for (const d of decisions) {
    const same = byLine.get(d.problem ?? '就诊层面')
    const next = same.find((x) => x.decidedAt > d.decidedAt)
    const nextMain = mains.find((x) => x.decidedAt > d.decidedAt)
    d.next = next ? { decision: next.id, days: diffDays(d.decidedAt, next.decidedAt), actions: next.actions.map((a) => `${a.action}${a.object ? ` ${a.object}` : ''}`), ...common({ provenance: '结构推出', basis: next.basis, rule: 'O4-同线下一节点', visibleAt: next.visibleAt }) } : null
    d.nextMain = nextMain ? { decision: nextMain.id, days: diffDays(d.decidedAt, nextMain.decidedAt), reasonCategory: null, reasonNote: '原因类别待模型判断＋医生确认' } : null
    d.linkText = null // 衔接说明（为什么进入这一步）：需模型从原文摘出，v0.1 不生成
    const line = d.problem ? linesById.get(d.problem) : null
    const pspec = spec.problems.find((p) => p.code === line?.code)
    const targets = (pspec?.targets ?? []).filter((c) => series.has(c))
    const outcomes = {}
    for (const [key, lo, hi] of WINDOWS) {
      let from = addDays(d.decidedAt, lo); let to = hi === Infinity ? lastContact : addDays(d.decidedAt, hi)
      let truncated = false
      if (next && next.decidedAt <= to) { to = addDays(next.decidedAt, -1); truncated = true }
      if (!lastContact || from > lastContact) { outcomes[key] = { observed: false, note: '超出数据范围（末次接触之后）' }; continue }
      if (to < from) { outcomes[key] = { observed: false, truncated: true, note: '下一个同线决策更早，窗口被截断' }; continue }
      const indicators = targets.map((c) => {
        const s = series.get(c)
        // 基线：动作当日及之前 180 天内末次值（当日检验多在就诊前抽血）；结局：窗口内、动作日之后的末次值
        const base = s.filter((x) => x.d <= d.decidedAt && diffDays(x.d, d.decidedAt) <= P.baselineDays).at(-1)
        const after = s.filter((x) => x.d >= from && x.d <= to && x.d > d.decidedAt).at(-1)
        if (!after) return { concept: c, direction: '未观察到', baseline: base ?? null }
        if (!base) return { concept: c, direction: '无基线', after }
        const ch = (after.v - base.v) / (Math.abs(base.v) || 1)
        return { concept: c, baseline: base, after, change: Math.round(ch * 1000) / 10, direction: Math.abs(ch) <= P.flatPct ? '基本不变' : ch > 0 ? '升高' : '降低' }
      })
      const set = memberOf.get(d.problem) ?? new Set()
      const newDx = dxEvents.filter((e) => set.has(e.id) && day(e.firstWritten) >= from && day(e.firstWritten) <= to && day(e.firstWritten) > d.decidedAt).map((e) => ({ concept: e.concept, day: day(e.firstWritten), event: e.id }))
      const admissions = stays.filter((s) => s.start >= from && s.start <= to && diffDays(d.decidedAt, s.start) > 1 && s.id !== d.encounter).map((s) => ({ encounter: s.id, start: s.start, end: s.end, dept: s.dept }))
      const concurrent = decisions.filter((x) => x.id !== d.id && x.problem !== d.problem && x.decidedAt >= d.decidedAt && x.decidedAt <= to && x.pointKind === '治疗改变').map((x) => ({ decision: x.id, problem: x.problemName, day: x.decidedAt, actions: x.actions.map((a) => `${a.action}${a.object ? ` ${a.object}` : ''}`) }))
      outcomes[key] = { observed: true, from, to, truncated, indicators, newDiagnoses: newDx, admissions, concurrent,
        ...common({ provenance: '结构推出', basis: [...indicators.flatMap((i) => [i.baseline?.mention, i.after?.mention]), ...newDx.map((x) => eventsById.get(x.event)?.firstMention)].filter(Boolean), rule: 'O4-窗口结局', visibleAt: maxDay([to, ...indicators.map((i) => i.after?.d)]) }) }
    }
    d.outcomes = outcomes
    d.followUpAdjust = next && next.pointKind === '治疗改变' ? { decision: next.id, days: diffDays(d.decidedAt, next.decidedAt) } : null
    Object.assign(d, common({ provenance: '原文写明', basis: d.basis, rule: 'O3-决策节点', visibleAt: d.visibleAt, certainty: d.formal ? '规则确定' : '需人工确认' }))
  }

  // ── 归：混杂候选（结构推出）
  const attributions = []
  for (const d of decisions) {
    if (d.pointKind !== '治疗改变') continue
    for (const [key] of WINDOWS) {
      const o = d.outcomes[key]
      if (!o?.observed || !o.indicators.some((i) => ['升高', '降低', '基本不变'].includes(i.direction))) continue
      attributions.push({
        id: stableId('A', d.id, key), decision: d.id, window: key, problem: d.problemName,
        outcome: o.indicators.filter((i) => i.after).map((i) => `${i.concept} ${i.baseline?.v ?? '?'}→${i.after.v}（${i.direction}）`).join('；'),
        shares: [{ intervention: d.actions.map((a) => `${a.action}${a.object ? ` ${a.object}` : ''}`).join('、'), share: null }],
        separability: null,
        confounders: o.concurrent.map((c) => ({ category: '并行干预', decision: c.decision, text: `${c.day} ${c.problem}：${c.actions.join('、')}`, provenance: '结构推出' })),
        ...common({ provenance: '结构推出', basis: o.basis, rule: 'O7-同窗口并行干预', visibleAt: o.visibleAt, certainty: '需人工确认' }),
        note: '份额与可分离性需模型判断＋医生确认后才算数',
      })
    }
  }

  // ── 诊：诊断清单与角色候选
  const lineOfEvent = new Map()
  for (const m of problems.members) { if (!lineOfEvent.has(m.event)) lineOfEvent.set(m.event, []); lineOfEvent.get(m.event).push(linesById.get(m.problem)) }
  const byName = new Map()
  for (const e of dxEvents) { if (!byName.has(e.concept)) byName.set(e.concept, []); byName.get(e.concept).push(e) }
  const diagnoses = []
  for (const [name, evs] of byName) {
    const ls = [...new Map(evs.flatMap((e) => lineOfEvent.get(e.id) ?? []).map((l) => [l.id, l])).values()]
    const main = ls.some((l) => l.isMainLine)
    const sub = ls.find((l) => ['从属子线', '并发症', '急性加重'].includes(l.kind) && l.parentBasis?.concepts?.includes(name))
    const category = main ? '主要诊断' : sub ? '并发症' : '合并症'
    const evalRole = main ? '主诊断' : sub ? '继发' : '共病'
    const ms = evs.flatMap((e) => e.mentions.map((id) => mentionsById.get(id))).filter(Boolean).sort((a, b) => a.writtenAt.localeCompare(b.writtenAt))
    const history = []
    for (const m of ms) { const c = m.certainty || '确定'; if (history.at(-1)?.certainty !== c) history.push({ from: day(m.writtenAt), certainty: c, mention: m.id }) }
    diagnoses.push({
      id: stableId('X', name), name, events: evs.map((e) => e.id), category, evalRole, problems: ls.map((l) => ({ id: l.id, label: l.label })),
      certaintyHistory: history, firstSeen: minDay(ms.map((m) => m.writtenAt)), lastSeen: maxDay(ms.map((m) => m.writtenAt)), mentions: ms.length,
      ...common({ provenance: '结构推出', basis: ms.slice(0, 5).map((m) => m.id), rule: main ? 'O5-主线问题的诊断' : sub ? 'O5-子线连接概念' : 'O5-其余为合并症', visibleAt: ms[0]?.writtenAt ?? null, certainty: '需人工确认' }),
    })
  }
  diagnoses.sort((a, b) => ['主要诊断', '并发症', '合并症'].indexOf(a.category) - ['主要诊断', '并发症', '合并症'].indexOf(b.category) || String(a.firstSeen).localeCompare(String(b.firstSeen)))

  // 关系：只收原文命名或结构从属能说明的（子线 → 父线）
  const relations = []
  for (const l of problems.lines) {
    if (!l.parent || !linesById.has(l.parent)) continue
    const parent = linesById.get(l.parent)
    const kind = l.kind === '急性加重' ? '加重' : '进展'
    relations.push({ id: stableId('R', l.id, l.parent, kind), from: parent.label, fromLine: parent.id, to: l.label, toLine: l.id, kind, basisText: l.parentBasis?.text ?? '',
      ...common({ provenance: l.parentBasis?.concepts?.length ? '原文写明' : '结构推出', basis: (l.parentBasis?.events ?? []).map((id) => eventsById.get(id)?.firstMention).filter(Boolean), rule: 'O5-子线归属', visibleAt: l.start }) })
  }

  // ── 人
  const choices = decisions.flatMap((d) => d.patientChoices.map((c) => ({ ...c, day: d.decidedAt, decision: d.id })))
  const person = {
    demographics: { sex: input.manifest.person?.sex ?? null, birth: input.manifest.person?.birth ?? null },
    preferences: choices,
    constraints: choices.map((c) => ({ kind: '患者意愿', text: c.text, decision: c.decision, mention: c.mention })),
    organFunction: [...series.entries()].filter(([c]) => ['血红蛋白', '肌酐', '白蛋白', 'BNP', '血钾'].includes(c)).map(([c, s]) => ({ concept: c, first: s[0], last: s.at(-1), n: s.length })),
    lastContact: { day: lastContact, survival: '未知', note: '数据终止不等于治疗终止或死亡' },
    ...common({ provenance: '结构推出', basis: choices.map((c) => c.mention), rule: 'O8-患者特征', visibleAt: lastContact }),
  }

  // ── 视图：问题列表时间轴（检／影 对齐）
  const timeline = {
    // 时间轴从就医记录开始（既往史里“10年余”这类早年叙述不拉长时间轴，线起点早于它时截在左端）
    range: { from: minDay([...decisions.map((d) => d.decidedAt), ...stays.map((s) => s.start), ...[...series.values()].map((s) => s[0]?.d)]) ?? minDay(problems.lines.map((l) => l.start)), to: lastContact },
    stays,
    series: [...series.entries()].filter(([, s]) => s.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([name, s]) => ({ name, points: s })),
  }
  return { decisions, attributions, diagnoses, relations, person, timeline, concurrents: [] }
}
