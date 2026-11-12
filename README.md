# 临床本体构建 · dsh-medical-ontology

DeepSeek Harness 插件（规划中，尚未实现）。读入“病历事件还原”交付的事件包，构建**患者级病程本体：以治疗决策为节点**——人／诊／治／伴／归（＋检／影），并标明每次决策如何引出下一次。每条结论带出处（原文写明／结构推出／模型判断）与医生复核状态。

> 当前 npm 上的 `0.0.x` 只是占位版本，不含任何代码，不能作为插件安装。
>
> Clinical Ontology Builder for DeepSeek Harness — work in progress. The `0.0.x` npm releases are name placeholders with no code.

注意：这里的“临床本体”不是 SNOMED 一类的术语本体。参照 <https://www.g-mpas.com/ontology.html>。

```
医疗数据匿名化 → 病历事件还原 → 【临床本体构建】 → 长病程临床推理评测
                                        └→ 因果链标注、模型训练、数据产品
```

## 文档

- [docs/family.md](docs/family.md)：插件家族、拆分理由、共同约定（四个仓库内容相同）
- [docs/brief.md](docs/brief.md)：本插件交接说明
- [docs/ontology-schema.md](docs/ontology-schema.md)：本体格式草案
- [docs/reference/](docs/reference/)：工序 5–6 设计文档、八道工序总结、G-MPAS 本体页与评测页文本
