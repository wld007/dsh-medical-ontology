/**
 * 引擎测试：用仓库里的虚构事件包（demo/event-package，全部编造）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readPackage } from '../lib/package/read.js'
import { loadRulepack, matchConcept } from '../lib/rulepack.js'
import { buildOntology } from '../lib/engine/pipeline.js'

const DEMO = fileURLToPath(new URL('../demo/event-package/DEMO-0001', import.meta.url))
const input = await readPackage(DEMO)
const rules = await loadRulepack('hemodialysis')
const onto = buildOntology(input, rules)
const find = (pred) => onto.decisions.find(pred)

test('读入事件包：格式与上游验收门', () => {
  assert.equal(input.manifest.format, 'event-package/0')
  assert.deepEqual(input.problems, [])
})

test('概念匹配：全等、前缀、通配', () => {
  assert.ok(matchConcept('慢性肾脏病*', '慢性肾脏病5期'))
  assert.ok(matchConcept('*', '维持性血液透析'))
  assert.ok(matchConcept('*骨折', '左肱骨近端骨折'))
  assert.ok(!matchConcept('贫血', '肾性贫血'))
})

test('问题线：长期问题、从属子线只凭原文、发作挂为并发症', () => {
  const byLabel = (code, kind) => onto.problems.find((l) => l.code === code && l.kind === kind)
  assert.ok(byLabel('P01', '长期问题').isMainLine)
  const anemia = byLabel('P08', '从属子线')
  assert.ok(anemia, '“肾性贫血”命名说明从属肾脏替代')
  assert.deepEqual(anemia.parentBasis.concepts.includes('肾性贫血'), true)
  assert.ok(byLabel('P07', '长期问题'), '没有“肾性骨病”连接概念时，矿物质与骨代谢是独立长期问题')
  const infection = onto.problems.filter((l) => l.code === 'P10')
  assert.equal(infection.length, 2)
  assert.ok(infection.some((l) => l.kind === '独立发作'), '肺部感染原文没写与通路有关 → 独立发作')
  assert.ok(infection.some((l) => l.kind === '并发症'), '人工血管感染 → 挂到血管通路下')
  assert.ok(byLabel('P03', '急性加重'))
})

test('决策节点：换抗凝药成点，现病史里的在用状态不成点', () => {
  assert.ok(find((d) => d.actions.some((a) => a.action === '停止' && a.object === '华法林')))
  assert.ok(find((d) => d.actions.some((a) => a.action === '更换' && a.object === '利伐沙班')))
  assert.ok(onto.excluded.some((x) => /在用状态|不是当次/.test(x.reason) && /华法林/.test(x.text)))
  // 计划继续且无新情况 → 不成点
  assert.ok(!find((d) => d.decidedAt === '2021-04-16'))
})

test('决策节点：同次就诊×同线合并；患者拒绝挂到建议住院的点', () => {
  const p = find((d) => d.decidedAt === '2019-09-20')
  assert.equal(p.actions.length, 2)
  const refuse = find((d) => d.patientChoices.length)
  assert.ok(refuse.actions.some((a) => a.action === '收治'))
  assert.equal(refuse.problemCode, 'P10')
})

test('决策节点：新情况、收治时刻取入院时间、干体重归容量线', () => {
  const stop = find((d) => d.actions.some((a) => a.action === '停止' && a.object === '华法林'))
  assert.ok(stop.indication.newSituations.some((n) => /国际标准化比值/.test(n.text)))
  const hf = find((d) => d.problemCode === 'P03' && d.actions.some((a) => a.action === '收治'))
  assert.equal(hf.decidedAt, '2023-05-06')
  assert.ok(find((d) => d.problemCode === 'P03' && d.actions.some((a) => a.object === '干体重调整')))
})

test('结局：窗口在下一个同线决策处截断；出处为结构推出', () => {
  const stop = find((d) => d.actions.some((a) => a.action === '停止' && a.object === '华法林'))
  assert.equal(stop.outcomes.d0_90.truncated, true)
  assert.equal(stop.outcomes.d0_90.provenance, '结构推出')
  assert.equal(stop.next.days, 28)
})

test('每条结论都有出处、依据、可见时间、复核状态', () => {
  for (const x of [...onto.decisions, ...onto.diagnoses, ...onto.relations, ...onto.attributions]) {
    assert.ok(['原文写明', '结构推出', '模型判断'].includes(x.provenance), x.id)
    assert.ok(Array.isArray(x.basis))
    assert.ok(x.review?.status)
    assert.ok('visibleAt' in x)
  }
})

test('稳定编号：重跑不变；人工裁定按编号沿用', () => {
  const again = buildOntology(input, rules, { review: { [onto.decisions[0].id]: { status: '已确认', at: 'x' } } })
  assert.deepEqual(again.decisions.map((d) => d.id), onto.decisions.map((d) => d.id))
  assert.equal(again.decisions[0].review.status, '已确认')
})

test('as-of：截断后只用此前写成的提及，后来的决策不可见', () => {
  const cut = buildOntology(input, rules, { asOf: '2020-09-01' })
  assert.ok(cut.decisions.every((d) => d.visibleAt <= '2020-09-01 23:59'))
  assert.ok(cut.decisions.length < onto.decisions.length)
  assert.ok(!cut.decisions.some((d) => d.actions.some((a) => a.object === '利伐沙班')))
})
