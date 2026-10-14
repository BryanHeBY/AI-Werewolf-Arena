# 已触达机制的逐格对账提案

只读提案，**不更新矩阵、不签 complete／N/A**。固定读取 Git `b4bce44302d9f79611ab2d36c5c7938c6528f990`；所列相关生产源码均同该 Git。旧矩阵 observed `13366731` 的 228 partial／682 pending 是登记历史，不是当前缺实现统计。

本轮三个 owner 已实际提交：Noble 安装 `2a14e678`、普通黎明准备 `8e334bac`、遗言窗口 `b4bce443`。它们不应继续当作待搬的代码。逐格原 owner、真实 producer→consumer、具体剩余门槛、35 份文档／收据来源见 [50 格提案](generated/selected-mechanism-cell-reconciliation-proposal.json)；[有界源码库存](generated/selected-mechanism-cell-reconciliation-inventory.json)不含全源码重复快照。

| 格 | Noble | Cupid | Hybrid | LastWords | 普通夜死：stages/night 子链 |
| --- | --- | --- | --- | --- | --- |
| state | 严格 reader、七 writer、双影子和最后两安装已归 owner；末验收 | 全旧安装／读／投影／两写已归槽；严格 schema 接受政策待决 | 全旧初态／读／投影／两写已归槽；同左 | World 原死者 permit 唯一；不造私态槽 | 原 night 引用＋局部提案副本；不造第二夜状态 |
| lease | 原／别名最早期限与永久 closed 已有；末整合 | 原请求交付／alias／期限／settlement 尚未接 | 同左，非 actor 退休旗可替代 | World permit 已有，request 交付闭包尚缺 | 依赖各族及 DR 窗口，纯同步准备不授许可 |
| eligibility | 原体／资源／目标 query 已有；跨贡献验收 | 原 current＋F05d 未付准入已有；合流验收 | 同左，目标与 paid 不滤 | 两 policy／sourcePhase＋原死者生命已有；政策矩阵验收 | Fox 原因＋原 Alive/version 筛选已有；三 caller 验收 |
| lifecycle | acquire／handoff／normal／abort／expiry 已有；完整周期验收 | 原首夜、重试及完成顺序已有；缺 lease 政策部分 | 原首夜／committed 日次已有；同左 | 完整 collect／await／finally 已迁；不再重拆 | nightSettled／真实 DR await／finish／abort 正确留 PM |
| effect | 保护、清除、到期、死亡关闭、放逐耗身已有 | 恋人绑定／殉情／Dream／胜负贡献已有 | 只改 Victory 归属、不改 Role／Camp，已有 | grant 与清洗 spoken 已有；sink/close 联验 | 原筛选／合并／发表已迁；真实标死仍 DR |
| observation | 知识裁剪、通知和受众已有；末消费者／F01验收 | 本人选择／伙伴知识已有；末受众／F01验收 | 本人选择已有；成员不授狼权；同源验收 | 公开事件／演员 feed 已有；许可不当知识 | 普通先公开、Animal／双生提交后公开已有 |
| checkpoint | 严格 Noble shape／贡献已有；新构建 strict 录制回放 | generic 整私态 clone 已有；族因果仍未校验 | 同左 | 通用事件／decision／eventCount 已有；失败 CP 联验 | publication→receipt 已有；prepare／sink／receipt 失败 CP 联验 |
| verifier | 独立 Noble ledger→Demon audit 已有；末同源 | **没有本族独立归档推导** | **没有本族独立归档推导** | 有限板子已有审计；普通 policy 的完整因果账本缺口 | 有复杂板子 verifier；普通关系／来源全覆盖未证 |
| text | 规则卡、公共展示和核心中文已有；最后核 | 规则卡／展示已有；fact reader 头仍英文 | 同左 | window／policy 中文已有；两政策文档最后对齐 | 新 owner 中文已有；timing 纯 query 头仍英文 |
| oldExports | 轻公共口及部分旧桥退休已有；全解析末核 | 旧 state 真删、ports 真接；末全形态查 | 同左 | DR 旧私有方法真退；原 singleton 仍合法 | 原块真迁出；不等于整个 NightStage 行闭合 |

这里的“末验收”不是再运行一个相同绿色 case：要先固定已合流源码，再完成实际 consumer／旧 API 全形态库存、对应规则组合和失败前缀、独立审计、新构建 strict 录制／回放及阶段同输入门禁。原局部 proof、12 根首次类型红及仅两失败根后继绿都保其原范围。

## 真正下一实现

1. **Cupid／Hybrid 独立归档账本**：可限定两个新 verifier、原 assembly 和一个独立畸变档案单元，共四源。独立重建 decision→事实→checkpoint eventCount→关系／Victory，不调用生产 World／状态 writer／resolver。需声明新拒绝政策、支持组合／版本和旧 16 verifier 的首错误顺序；现有事实 reader 只校形，不能替代这项。
2. **普通关系／遗言请求的交付闭包**：先独立现状实验和政策，尚不具备机械开发 scope。当前 actor/current／World permit 不等于 request body/context、期限 alias、单调终态及领域提交后 settlement。不能复用此前其它四族 F02 的实验结果冒这三个窗口已经闭合。

Noble、选择数据槽、遗言完整窗口和普通黎明准备没有新的拆文件理由。Cupid／Hybrid 的宽 live cast 与普通整容器 clone 也是明确保留的接受行为；早加严格 parser 必须另定政策，不能靠小切片清格。

本轮未改生产、测试、ledger 或 progress；未运行任何新类型、测试、证明、门禁或模型。候选风险均是静态实现／覆盖分析，不冒执行红或生产用户 bug。
