# 本体格式（草案 v0）

> `dsh-medical-ontology` 的交付物，`dsh-medical-eval` 等下游读取。状态：**草案；v0 已按本文实现（`lib/package/write.js`，manifest.format = `clinical-ontology/0`），尚未定稿**。实现与本文有出入时以实现为准，并回写本文。
> v0 的出入：`concurrents.jsonl` 为空（伴发事件需模型＋医生）；`attributions` 只有结构推出的混杂候选，`shares[].share` 与 `separability` 为 null；`decisions.linkText` 与 `nextMain.reasonCategory` 为 null；人工裁定存 `_records/review.json`。
> 所有对象都带公共字段（见末尾）。引用事件包里的对象一律用其稳定编号，不复制原文。

## 文件

```
<outputRoot>/<输入名>/<patient>/
  manifest.json          # format、producer、rulepacks（病种层）、upstream（事件包 format 与 runId）、anchor（D+0 定义）、counts、review 进度
  person.json            # 人
  problems.jsonl         # 问题线（含子线、发作）
  problem_members.jsonl  # 事件在线程里的角色
  diagnoses.jsonl        # 诊：诊断、角色、确定程度历史
  relations.jsonl        # 诊：疾病关系
  decisions.jsonl        # 治：决策节点与闭环
  concurrents.jsonl      # 伴：伴发事件
  attributions.jsonl     # 归：结局归因
  views/                 # 检／影 对齐、问题列表时间轴等可再生视图
```

## person.json（人）

`demographics`、`organFunction`（器官功能与营养趋势，引用检验事件）、`preferences`（意愿：拒绝/选择，引用患者方决定）、`supportAccess`、`performance`（体能状态）、`constraints[]`（治疗限制因素：`kind` 器官功能/患者意愿/药品可及性/费用，描述，所涉决策节点）、`lastContact`（末次接触日、去向、生存状态“未知”等）。

## problems.jsonl（问题线）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号 |
| `code`、`name` | 病种层词表里的问题编号与名称（如 P04 心律与抗栓） |
| `kind` | 长期问题／子线（并发症或急性加重）／独立发作 |
| `parent` | 子线、发作所挂的长期问题；`parentBasis`（连接概念与依据，只凭原文） |
| `isMainLine` | 是否主线（口径待定，见 brief §6） |
| `start`、`end` | 起止（发作：起点规则与窗口） |
| `doubtful[]` | 存疑区间：起止、所涉发现编号 |

## problem_members.jsonl

`problem`、`event`、`role`（状态／干预／观测／判断／流程／存疑）、`primary`（主线/次线）、`rule`。

## diagnoses.jsonl（诊）

| 字段 | 含义 |
|---|---|
| `id`、`event` | 对应事件包里的诊断事件 |
| `name` | 归一名 |
| `category` | 主要诊断／并发症／治疗相关不良事件／合并症 |
| `evalRole` | 给 T07：主诊断／继发／不良事件／共病 |
| `certaintyHistory[]` | `{from, certainty: 确诊/临床诊断/疑似/待定, mentions}`，按写成时间 |
| `firstSeen`、`lastSeen` | |

## relations.jsonl（疾病关系）

`from`、`to`（诊断或治疗节点）、`kind`（进展／治疗相关／加重／共存／风险相关／鉴别诊断）、`interval`（如“间隔约 3.5 个月”）。

## decisions.jsonl（治：决策节点与闭环）

| 字段 | 含义 |
|---|---|
| `id` | 稳定编号 |
| `problem` | 所在问题线 |
| `nodeKind` | 治疗节点／检查节点／关键流程 |
| `pointKind` | 治疗改变／关键流程／有新情况的维持 |
| `isMainLine` | 是否主线节点 |
| `decidedAt`、`visibleAt`、`backfilled` | 决策时刻、可见时刻（最早写成）、是否补记 |
| `actions[]` | `{type: 8 类动作之一, object, actionMention, rule}` |
| `actionText` | 决策原文（提及编号） |
| `linkText` | **衔接说明**（为什么进入这一步）：单独存，出题时隐去 |
| `indication` | 适应证：新情况（诊断/超出参考区间的检验）、写明的理由、问题状态；均引用提及 |
| `scheduled[]`、`patientChoices[]` | 同时安排的检查复查；患者方决定 |
| `execution` | 实际执行：执行状态、首次执行日、佐证（收费、执行记录、出院记录转述） |
| `nonClinical` | 非临床因素：缺药、费用、病人拒绝…… |
| `outcomes` | `{d0_90, d91_180, d180_plus}`：每段若干条 `{text, events, direction?}` |
| `next` | 到下一个主线节点：`{decision, days, reasonCategory, reasonBasis}` |
| `followUpAdjust` | 后续治疗调整（引出的下一次决策） |
| `doubtful` | 落在存疑区间：保留但不进正式题 |

## concurrents.jsonl（伴）

`mainDecision`、`problemEvent`（其他方向出现的问题）、`parallelDecision`、`outcome`、`impactOnMain`（不受影响／暂停后恢复／减量或降级／提前换线／中止）、`trigger`（新发疾病／不良事件／合并症加重／药品短缺／自行停药／中断治疗／要求转院）。

## attributions.jsonl（归）

`decision`（被归因的治疗链）、`window`（0–90／91–180／180+）、`outcome`、`shares[]`（`{intervention, share: 主要/部分/微小/无/不可判定}`）、`separability`（可分离／部分可分离／不可分离）、`confounders[]`（类别：并行干预、宿主因素、自然病程…；结构推出的候选与模型/医生确认的分开标）、`reason`。

## 公共字段（每个对象都有）

| 字段 | 含义 |
|---|---|
| `provenance` | 原文写明／结构推出／模型判断 |
| `basis` | 引用的提及编号（事件包） |
| `rule` | 命中的规则（规则产生时） |
| `model` | 模型意见：模型名、结论、引用、原文核对结果（模型产生时） |
| `visibleAt` | 本结论的可见时间 ＝ 所用证据中最晚的写成时间（as-of 用） |
| `certainty` | 规则确定／需人工确认…… |
| `review` | 未复核／已确认／已改判／驳回，复核人、时间、备注 |

## 待定

- 血透“主线”口径；原因类别、8 类动作的病种差异。
- `outcomes` 的方向判定（±10% 阈值，基线回看 180 天，沿用工序8）是否在本体里算好，还是交给评测插件算。
- 与因果链标注项目 `contracts/` 的字段对齐方式。
