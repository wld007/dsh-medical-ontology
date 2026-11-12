/** 日期与公共小工具。日期一律 'YYYY-MM-DD'，按 UTC 日计算，不受时区影响。 */
export const DAY = 86400000
export const day = (s) => (s ? String(s).slice(0, 10) : null)
export const t = (s) => (s ? Date.parse(`${day(s)}T00:00:00Z`) : NaN)
export const addDays = (s, n) => new Date(t(s) + n * DAY).toISOString().slice(0, 10)
export const diffDays = (a, b) => Math.round((t(b) - t(a)) / DAY)
export const minDay = (xs) => xs.filter(Boolean).map(day).sort()[0] ?? null
export const maxDay = (xs) => xs.filter(Boolean).map(day).sort().at(-1) ?? null

/** 事件时间：共识区间起点，缺则止点，再缺用首次写成。 */
export const eventDay = (e) => day(e.consensus?.a ?? e.consensus?.b ?? e.firstWritten)
/** 提及的发生日：发生时间起点，缺则写成日。 */
export const mentionDay = (m) => day(m.occurFrom ?? m.occurTo ?? m.writtenAt)

export function groupBy(rows, key) {
  const out = new Map()
  for (const r of rows) { const k = key(r); if (!out.has(k)) out.set(k, []); out.get(k).push(r) }
  return out
}

/** 公共字段（ontology-schema 末尾）。 */
export function common({ provenance, basis = [], rule = null, visibleAt = null, certainty = '规则确定' }) {
  return { provenance, basis: [...new Set(basis)], rule, model: null, visibleAt, certainty, review: { status: '未复核' } }
}

/** 检验数值与异常方向：结构化检验提及形如 “血红蛋白 82 g/L（115-150）↓”。 */
export function labReading(e, mentionsById) {
  const ms = e.mentions.map((id) => mentionsById.get(id)).filter(Boolean)
  const m = ms.find((x) => x.kind === '结构化') ?? ms[0]
  const v = Number.parseFloat(String(e.value ?? m?.text?.match(/(-?\d+(?:\.\d+)?)/)?.[1] ?? ''))
  const flag = /↑/.test(m?.text ?? '') ? '↑' : /↓/.test(m?.text ?? '') ? '↓' : ''
  return { v: Number.isFinite(v) ? v : null, flag, mention: m?.id ?? null }
}
