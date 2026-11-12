/** 批次报告（Markdown）。不含病历原文。 */
const STATUS = { running: '运行中', completed: '完成', review: '完成（有待复核）', failed: '失败', cancelled: '已取消' }

export function renderReport(run) {
  const t = run.totals
  const lines = [
    `# 临床本体构建 · 批次 ${run.id}`,
    '',
    `- 状态：${STATUS[run.status] ?? run.status}`,
    `- 输入：${run.input}`,
    `- 输出：${run.output ?? '（未交付）'}`,
    `- 病种规则包：${run.specialty}`,
    `- 截至时刻：${run.asOf ?? '不截断'}`,
    `- 开始 ${run.startedAt}，结束 ${run.finishedAt ?? '—'}`,
    '',
    '## 汇总',
    '',
    '| 病人 | 问题线 | 决策节点 | 进正式题 | 诊断 | 疾病关系 | 归因候选 | 待复核 |',
    '|---|---|---|---|---|---|---|---|',
    `| ${t.done}/${t.patients} | ${t.lines} | ${t.decisions} | ${t.formal} | ${t.diagnoses} | ${t.relations} | ${t.attributions} | ${t.review} |`,
    '',
    '## 各病人',
    '',
    '| 病人 | 上游 | 问题线 | 存疑区间 | 决策节点（正式） | 主线节点 | 未归线程事件 | 待复核 |',
    '|---|---|---|---|---|---|---|---|',
    ...run.patients.map((p) => `| ${p.patient} | ${p.problems.length ? `⚠ ${p.problems.join('；')}` : '通过'} | ${p.summary.lines} | ${p.summary.doubtful} | ${p.summary.decisions}（${p.summary.formal}） | ${p.summary.mainLineDecisions} | ${p.summary.unassigned} | ${p.summary.review} |`),
    '',
    '## 口径',
    '',
    '- 问题线、决策节点按工序5 v1.1、工序6 v1.1 的规则重新实现；词表与主线定义在病种层规则包。',
    '- 每条结论带出处（原文写明／结构推出／模型判断）、依据提及编号、可见时间与复核状态。',
    '- 结局是“动作后观察到的”，不等于“动作造成的”；归因只列结构推出的混杂候选，份额待模型＋医生。',
    '- v0.1 未实现：伴发事件、归因份额、衔接说明、原因类别（需模型与医生复核）。',
  ]
  if (run.warnings?.length) lines.push('', '## 提示', '', ...run.warnings.map((w) => `- ${w}`))
  if (run.error) lines.push('', '## 错误', '', '```', run.error.split('\n').slice(0, 6).join('\n'), '```')
  return { markdown: lines.join('\n') + '\n', json: { id: run.id, status: run.status, totals: t, patients: run.patients.map((p) => ({ patient: p.patient, summary: p.summary })) } }
}
