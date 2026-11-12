/**
 * 一位病人：事件包 → 本体。纯函数，可按截止时刻（as-of）重算。
 *   O1 读入（截断）→ O2 问题线 → O3 决策节点 → O4–O8 组装 → 套用人工裁定
 */
import { buildProblems } from './o2-problems.js'
import { buildDecisions } from './o3-decisions.js'
import { assemble } from './o4-assemble.js'
import { day, diffDays, minDay } from './util.js'

export const FORMAT = 'clinical-ontology/0'

/**
 * as-of：只保留截止时刻以前写成的提及；事件只留可见的成员，全不可见的事件丢弃；
 * 涉及不可见事件的发现丢弃。事件的共识时间等属性沿用上游结果（严格截断请用事件插件 asOf 重跑上游）。
 */
export function cutAt(input, asOf) {
  if (!asOf) return input
  const cut = String(asOf).length <= 10 ? `${asOf} 23:59` : String(asOf)
  const mentions = input.mentions.filter((m) => m.writtenAt <= cut)
  const visible = new Set(mentions.map((m) => m.id))
  const events = []
  for (const e of input.events) {
    const ms = e.mentions.filter((id) => visible.has(id))
    if (!ms.length) continue
    const written = ms.map((id) => input.mentions.find((m) => m.id === id)?.writtenAt).filter(Boolean).sort()
    events.push({ ...e, mentions: ms, mentionCount: ms.length, firstWritten: written[0], lastWritten: written.at(-1), firstMention: ms.includes(e.firstMention) ? e.firstMention : ms[0] })
  }
  const kept = new Set(events.map((e) => e.id))
  const findings = input.findings.filter((f) => f.events.every((id) => kept.has(id)) && (f.sides ?? []).every((s) => !s.firstWritten || s.firstWritten <= cut))
  const encounters = input.encounters.filter((x) => !x.start || x.start <= cut).map((x) => (x.end && x.end > cut ? { ...x, end: null } : x))
  return { ...input, mentions, events, findings, encounters }
}

/** 人工裁定（按稳定编号）套回结果：review 字段与复核状态。 */
export function applyReview(onto, table = {}) {
  const all = [...onto.decisions, ...onto.diagnoses, ...onto.relations, ...onto.attributions, ...onto.problems]
  for (const x of all) {
    const r = table[x.id]
    if (r) x.review = { status: r.status, note: r.note ?? '', by: r.by ?? 'user', at: r.at, ...(r.value !== undefined ? { value: r.value } : {}) }
  }
  return onto
}

export function buildOntology(raw, rules, { asOf = null, review = {} } = {}) {
  const t0 = Date.now()
  const input = cutAt(raw, asOf)
  const problems = buildProblems(input, rules)
  const decided = buildDecisions(input, rules, problems)
  const parts = assemble(input, rules, problems, decided)
  const spec = rules.specialty
  const mainLines = problems.lines.filter((l) => spec.anchor && l.code === spec.anchor.problem && l.kind !== '独立发作')
  const anchorDay = minDay(problems.members.filter((m) => mainLines.some((l) => l.id === m.problem) && m.group === '诊断').map((m) => input.events.find((e) => e.id === m.event)?.firstWritten))
    ?? minDay(input.mentions.map((m) => m.writtenAt))
  const rel = (d) => (d ? `D+${diffDays(anchorDay, day(d))}` : null)
  for (const l of problems.lines) l.review = { status: '未复核' }
  const onto = {
    format: FORMAT,
    asOf: asOf ?? null,
    anchor: { day: anchorDay, basis: spec.anchor?.basis ?? '最早写成时间' },
    problems: problems.lines,
    members: problems.members,
    unassigned: problems.unassigned,
    decisions: parts.decisions,
    excluded: decided.excluded,
    reportedOnly: decided.reportedOnly,
    diagnoses: parts.diagnoses,
    relations: parts.relations,
    attributions: parts.attributions,
    concurrents: parts.concurrents,
    person: parts.person,
    timeline: parts.timeline,
  }
  applyReview(onto, review)
  const dec = onto.decisions
  onto.summary = {
    lines: problems.lines.length,
    linesByKind: problems.lines.reduce((a, l) => { a[l.kind] = (a[l.kind] ?? 0) + 1; return a }, {}),
    doubtful: problems.lines.reduce((s, l) => s + l.doubtful.length, 0),
    members: problems.members.length,
    unassigned: Object.values(problems.unassigned).reduce((a, b) => a + b, 0),
    decisions: dec.length,
    formal: dec.filter((d) => d.formal).length,
    pointKinds: dec.reduce((a, d) => { a[d.pointKind] = (a[d.pointKind] ?? 0) + 1; return a }, {}),
    mainLineDecisions: dec.filter((d) => d.isMainLine).length,
    excluded: decided.excluded.length,
    reportedOnly: decided.reportedOnly.length,
    diagnoses: parts.diagnoses.length,
    relations: parts.relations.length,
    attributions: parts.attributions.length,
    review: [...dec, ...parts.diagnoses, ...parts.relations, ...parts.attributions].filter((x) => x.certainty === '需人工确认' && x.review?.status === '未复核').length,
    reviewed: [...dec, ...parts.diagnoses, ...parts.relations, ...parts.attributions, ...problems.lines].filter((x) => x.review?.status && x.review.status !== '未复核').length,
    ms: Date.now() - t0,
  }
  onto.rel = rel
  return onto
}
