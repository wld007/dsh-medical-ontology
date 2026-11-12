/**
 * 规则包：通用层（决策点来源、写法、参数）＋病种层（问题线词表、主线、找线写法）。
 * 规则包只能是纯数据；正则写成字符串，这里编译。
 */
const SPECIALTIES = {
  hemodialysis: () => import('../rules/specialty/hemodialysis/index.mjs'),
}

export const specialtyIds = () => Object.keys(SPECIALTIES)

function assertPlainData(value, path) {
  if (typeof value === 'function') throw new Error(`规则包不能包含函数：${path}`)
  if (value === null || typeof value !== 'object') return
  for (const [k, v] of Object.entries(value)) assertPlainData(v, `${path}.${k}`)
}

export async function loadRulepack(specialty = 'hemodialysis') {
  const general = (await import('../rules/general/index.mjs')).default
  const load = SPECIALTIES[specialty]
  if (!load) throw new Error(`没有病种规则包：${specialty}（可用：${specialtyIds().join('、')}）`)
  const spec = (await load()).default
  assertPlainData(general, 'general')
  assertPlainData(spec, specialty)
  const re = Object.fromEntries(Object.entries(general.patterns).map(([k, v]) => [k, new RegExp(v)]))
  return { general, specialty: spec, params: general.params, re, layers: [general, spec].map((p) => ({ id: p.id, layer: p.layer, version: p.version, basedOn: p.basedOn })) }
}

/** 概念匹配："*" 任意；"x*" 前缀；"*x" 后缀；"*x*" 包含；否则全等。 */
export function matchConcept(pattern, concept) {
  if (!concept) return false
  if (pattern === '*') return true
  const head = pattern.startsWith('*'); const tail = pattern.endsWith('*')
  const core = pattern.replace(/^\*|\*$/g, '')
  if (head && tail) return concept.includes(core)
  if (tail) return concept.startsWith(core)
  if (head) return concept.endsWith(core)
  return concept === core
}
