/**
 * O2 问题线（工序5 设计 v1.1）：按病种词表把事件挂到临床问题上。
 * 长期问题一条线贯穿全程；发作按起点切分；子线只凭原文（结构从属或诊断命名）；
 * 工序4 未决的矛盾/证据不足标为存疑区间。只排已有事件，不补、不写因果。
 */
import { stableId } from '../ids.js'
import { matchConcept } from '../rulepack.js'
import { addDays, day, diffDays, eventDay, maxDay, minDay } from './util.js'

const SKIP_GROUPS = new Set(['宣教模板', '背景', '就医经过', '表单占位', '其他', '病史否认', '生命体征', '查体发现', '收费'])

export function roleOf(e) {
  if (e.type === '判断') return e.conceptGroup === '诊断' ? '状态' : '判断'
  if (e.type === '决策') return e.subdivision === '诊疗流程' ? '流程' : '干预'
  return '观测'
}

function matches(problem, e) {
  const list = problem.concepts?.[e.conceptGroup] ?? []
  return list.some((p) => matchConcept(p, e.concept))
}

/** 起点资格：非模板、非阴性、非回顾转述的提及至少一条；结构化“住院”诊断须落在真实住院内。 */
function canOpen(e, ctx) {
  if (e.polarity === '阴性') return false
  if (ctx.spec.nonSpecific.includes(e.concept)) return false
  if (!['诊断', '用药', '手术操作'].includes(e.conceptGroup)) return false
  return e.mentions.some((id) => {
    const m = ctx.mentionsById.get(id)
    if (!m || m.templated || m.negative || m.temporality === '回顾转述') return false
    if (m.kind === '结构化' && /｜住院/.test(m.text)) {
      const d = day(m.occurFrom ?? m.writtenAt)
      return ctx.stays.some((s) => d >= s.start && d <= s.end)
    }
    return true
  })
}

export function buildProblems(input, rules) {
  const spec = rules.specialty; const P = rules.params
  const mentionsById = new Map(input.mentions.map((m) => [m.id, m]))
  const stays = input.encounters.filter((x) => x.kind === '住院' && x.start)
    .map((x) => ({ id: x.id, start: day(x.start), end: day(x.end) ?? addDays(x.start, P.defaultStayDays) }))
  const ctx = { spec, mentionsById, stays }
  const events = input.events.filter((e) => e.concept && !SKIP_GROUPS.has(e.conceptGroup) && !e.mentions.every((id) => mentionsById.get(id)?.templated))

  // 1) 词表挂接：一个事件可挂多条，按词表顺序第一个为主线
  const hits = new Map() // eventId → [code]
  for (const e of events) {
    // 主线＝词表顺序第一个；但点名的概念优先于通配（“干体重调整”主线是容量与心衰，次线才是肾脏替代的“透析：*”）
    const exact = (p) => (p.concepts?.[e.conceptGroup] ?? []).includes(e.concept)
    const found = spec.problems.filter((p) => matches(p, e))
    const codes = [...found.filter(exact), ...found.filter((p) => !exact(p))].map((p) => p.code)
    if (codes.length) hits.set(e.id, codes)
  }
  const byCode = new Map(spec.problems.map((p) => [p.code, []]))
  for (const e of events) for (const c of hits.get(e.id) ?? []) byCode.get(c).push(e)

  const lines = []; const members = []
  const addMember = (line, e, primary, rule) => members.push({ problem: line.id, event: e.id, role: roleOf(e), primary, rule, day: eventDay(e), concept: e.concept, group: e.conceptGroup })

  // 2) 长期问题：一条线
  const longLine = new Map()
  for (const p of spec.problems.filter((x) => x.kind === '长期问题')) {
    const evs = byCode.get(p.code)
    if (!evs.length) continue
    const line = { id: stableId('L', p.code), code: p.code, name: p.name, kind: '长期问题', parent: null, parentBasis: null, isMainLine: spec.mainProblems.includes(p.code), doubtful: [] }
    // 子线归属只凭原文：结构从属（无 parentOnly）或命中连接概念
    if (p.parent && (!p.parentOnly || evs.some((e) => p.parentOnly.includes(e.concept)))) {
      line.kind = '从属子线'; line.parent = stableId('L', p.parent)
      line.parentBasis = { text: p.parentBasis, concepts: p.parentOnly ? evs.filter((e) => p.parentOnly.includes(e.concept)).map((e) => e.concept) : [], events: p.parentOnly ? evs.filter((e) => p.parentOnly.includes(e.concept)).map((e) => e.id) : [] }
    }
    for (const e of evs) addMember(line, e, hits.get(e.id)[0] === p.code, `O2-挂接 ${p.code}`)
    longLine.set(p.code, line); lines.push(line)
  }

  // 3) 发作：起点按就诊切分，其余事件落在窗口内才挂接
  const episodeSpecs = [
    ...spec.problems.filter((p) => p.kind === '发作').map((p) => ({ p, evs: byCode.get(p.code), openers: (e) => canOpen(e, ctx) })),
    ...spec.exacerbations.map((x) => { const p = spec.problems.find((q) => q.code === x.problem); return { p, x, evs: byCode.get(x.problem), openers: (e) => x.concepts.includes(e.concept) && canOpen(e, ctx) } }),
  ]
  for (const { p, x, evs, openers } of episodeSpecs) {
    if (!evs?.length) continue
    const starts = evs.filter(openers).map((e) => ({ e, d: eventDay(e), stay: stays.find((s) => eventDay(e) >= s.start && eventDay(e) <= s.end) })).sort((a, b) => a.d.localeCompare(b.d))
    const clusters = []
    for (const s of starts) {
      const last = clusters.at(-1)
      if (last && ((s.stay && last.stay?.id === s.stay.id) || (!s.stay && diffDays(last.end, s.d) <= P.episodeGapDays))) {
        last.openers.push(s.e); last.end = maxDay([last.end, s.d, s.stay?.end])
      } else clusters.push({ openers: [s.e], start: s.d, end: maxDay([s.d, s.stay?.end]), stay: s.stay })
    }
    for (const c of clusters) {
      const lo = addDays(c.start, -P.episodeSlackDays); const hi = addDays(c.end, P.episodeSlackDays)
      const inside = evs.filter((e) => { const d = eventDay(e); return d >= lo && d <= hi })
      const line = { id: stableId('L', p.code, x ? '急性加重' : '发作', c.openers[0].id), code: p.code, name: p.name, kind: x ? '急性加重' : '独立发作', parent: null, parentBasis: null, isMainLine: false, doubtful: [], start: c.start, end: c.end, stay: c.stay?.id ?? null, openers: c.openers.map((e) => e.id) }
      if (x) { line.parent = longLine.get(x.problem)?.id ?? null; line.parentBasis = { text: x.basis, concepts: c.openers.map((e) => e.concept), events: c.openers.map((e) => e.id) } } else {
        for (const a of p.attach ?? []) {
          const link = inside.filter((e) => a.concepts.some((q) => matchConcept(q, e.concept)))
          if (link.length) { line.kind = '并发症'; line.parent = stableId('L', a.to); line.parentBasis = { text: a.basis, concepts: link.map((e) => e.concept), events: link.map((e) => e.id) }; break }
        }
      }
      line.label = `${p.name} · ${line.kind} ${c.start}`
      for (const e of inside) addMember(line, e, true, c.openers.includes(e) ? 'O2-发作起点' : 'O2-窗口挂接')
      lines.push(line)
    }
  }

  // 起止、事件数
  const byLine = new Map(lines.map((l) => [l.id, []]))
  for (const m of members) byLine.get(m.problem)?.push(m)
  for (const l of lines) {
    const ms = byLine.get(l.id)
    l.start ??= minDay(ms.map((m) => m.day)); l.end ??= maxDay(ms.map((m) => m.day))
    l.events = ms.length; l.primaryEvents = ms.filter((m) => m.primary).length
    l.roles = ms.reduce((acc, m) => { acc[m.role] = (acc[m.role] ?? 0) + 1; return acc }, {})
    l.label ??= l.name
  }

  // 4) 存疑区间：工序4 未决的矛盾与证据不足
  const eventLines = new Map()
  for (const m of members) { if (!eventLines.has(m.event)) eventLines.set(m.event, new Set()); eventLines.get(m.event).add(m.problem) }
  const eventsById = new Map(input.events.map((e) => [e.id, e]))
  for (const f of input.findings) {
    if (!['矛盾', '证据不足'].includes(f.verdict) || f.review?.decision) continue
    const days = f.events.map((id) => eventsById.get(id)).filter(Boolean).flatMap((e) => [e.consensus?.a, e.consensus?.b, e.firstWritten, e.lastWritten])
    const iv = { from: minDay(days), to: maxDay(days), finding: f.id, verdict: `${f.verdict}·${f.subclass ?? ''}`, concepts: [...new Set(f.events.map((id) => eventsById.get(id)?.concept).filter(Boolean))] }
    const touched = new Set(f.events.flatMap((id) => [...(eventLines.get(id) ?? [])]))
    for (const l of lines) if (touched.has(l.id) && (l.kind === '长期问题' || l.kind === '从属子线' || (iv.to >= l.start && iv.from <= l.end))) l.doubtful.push(iv)
  }

  // 5) 未归线程：没命中词表的事件，按概念组汇总
  const unassigned = {}
  const CLINICAL = new Set(['诊断', '用药', '检验结果', '症状', '手术操作', '透析', '检查结论'])
  for (const e of events) if (!hits.has(e.id) && CLINICAL.has(e.conceptGroup)) { const k = `${e.conceptGroup}｜${e.concept}`; unassigned[k] = (unassigned[k] ?? 0) + 1 }

  return { lines, members, unassigned }
}
