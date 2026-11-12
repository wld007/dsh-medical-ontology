# 给开发代理的约定

## 开始前

1. 读 `docs/family.md`，再读 `docs/brief.md`、`docs/ontology-schema.md`。
2. 唯一输入是事件包，格式见 `../dsh-medical-event/docs/event-package.md`；不要回头读病历原文。
3. 问题线、决策点的规则查 `docs/reference/工序5_问题线程/设计.txt`、`工序6_决策点/设计.txt`；**不要复用旧 Python 脚本**。
4. 实现方式参照匿名化插件 `../dsh-medical-anonymizer`；界面风格参照 `../dsh-medical-event/design/`。

## 必须遵守

- 每条结论带出处、依据（提及编号）、可见时间、复核状态（family.md §4.5）。模型判断必须引用提及编号并通过原文核对，没有医生确认的因果边不能当事实用。
- 不推断未写下的事件；不凭常识归属（如“透析病人易感染”）。
- 问题线词表、主线定义、原因类别放病种层规则包，不写死血透。
- 编号稳定；人工裁定存裁定表，重跑沿用。
- 不把病历派生内容复制进仓库；测试用虚构数据。
- 改了 `docs/family.md` 要同步到另外两个仓库；本体格式改动要升版本并通知 `dsh-medical-eval`。

## 读 iCloud 资料

`~/Library/Mobile Documents/com~apple~CloudDocs/未命名文件夹/` 不能列目录，但能直接读已知路径的文件；列文件用 `mdfind -onlyin "<目录>" "kMDItemFSName == '*'"`。

## 更新本机安装的插件

有批次在运行时不要更新、重装、启用或停用插件；操作前用 `ontology_runs` 确认。
