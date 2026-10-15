# P9d 迷雾鸦影状态与授权基础

基线 `6daf905`。本批为可构建基础切片：两个原生资源状态、每夜施法者授权、唯一夜 owner、待定直伤结算及有限板判别器。两角色仍 planned，目录仍 44/64；未注册角色、未提供可运行 CLI 板型，未接实际 NightPipeline／PhaseManager／SDK／ACP／MCP／记录和界面。

## 已落地的基础职责

- 雾、蛇及狼鸦额外刀独立库存和历史；严格 own-data 读取拒绝 Proxy、getter、伪库存及重复／消费后历史。
- Caster authority 保存原 Role、实际 Camp、Identity、privateState、原生命及版本、原状态／历史行／内层目标数组引用和规范值。合法雾→蛇、解封→额外刀原子安装新状态并同步更新预期；外部同值替换不能继承旧授权。首次原身体死亡只允许读取已支付信息／知识；所有资源写入仍须原身体存活，复活或新生命不继承。
- NightFrame 在 install 即绑定并验证两角色初始状态；真实 beginNight 只执行一次解封检查，严格少于三狼，知识只存当刻活狼且以后保留已知死队友。原生角色／阵营／身份／能力来源、参数、对象及原型维持绑定。
- 雾范围由规范提交历史导出，普通刀交接必须在圈内；有合法圈目标不能交空刀。额外刀拥有独立原生命 scope，允许圈外目标，scope 冻结。随机出刀及真实普通刀标记仍待执行层接入。
- 延迟资格在夜初冻结；Snake window 从已冻结普通刀和原生命导出目标，仅首夜主动自救。空刀、已真实死亡刀口只允许 pass；开窗失败直接中止本夜，只有合法决定设置 snakeDecided。外部校验回调重入、abort 或抛错不得恢复窗口／消费库存。
- PendingNight 唯一从 pending→committing→committed/aborted；首次 await 前领取。直接伤害只删除普通刀来源，确认梦牵连恰在最终救治后；保存全部原夜生命。finish 必须核验原生命真实死亡，辅助对象本身不切阶段／标死亡／判胜。
- game-text 提供精确十二人有限判别器，供下一切片统一配置／bootstrap／Tape。函数存在不等于该角色已获执行许可。

## 交叉审查与修正

review_scholar_rules（R）、review_configuration_closure（A）、review_scholar_delivery（T/L/D）只读审查，主任务修正，原报告者独立复验：

1. Pending 的厂生命 accessor 被替换仍获授权，校验回调能重入或恢复终态：原 8 红。改为读取 alive 前核厂 descriptor、同步占位、回调后重查、异常原样保留并 abort。严格错误代替早期静默空伤害，原报告者新 11 项／33 断言通过；原红证据保留。非直接伤害梦目标的替换 getter 在 Dream 展开前拒绝，调用 0。
2. Caster 漏内层同值 targetIds 及独立 Camp 元件：原独立 15 pass／5 fail。补引用和 actual Camp 字段后原文件 20 pass／74 断言；合法状态更新保持。
3. NightFrame 首夜前状态未绑定、校验后调用外来数组方法使目标分叉、非法开 Snake 后仍可正常 close：原独立 4 pass／6 fail。install 绑定初值；效果从内部规范数据派生；独立 snakeDecided 和失败封口。原两文件原样 10 pass／27 断言。R/T 分别用独立 stdin 复验非法开窗、雾圈、空刀／圈耗尽、合法用药。
4. 连梦测试改为实际 DreamFrame 的 consecutiveDeaths(world) 后验证仅一次 consecutive 事件；摄梦 fixture 明确传 NetEase 保护政策并字面断言。手写死亡、库存和知识预期没有调用生产函数生成 oracle。

临时首次 preset 测试错误承诺共享浏览器数据拷贝器的 Proxy trap 不执行，27/1 失败；纠正为 getter 不执行、Proxy 异常拒绝，共享拷贝器未改。临时 type 命令先有错误编译器路径、Bun 类型解析及一条 Array descriptors 类型诊断，修正配置和显式 object descriptor 类型后通过。迁移后一次从 root 使用 backend 相对测试路径未匹配，改按 backend 支持入口执行；不将这些失败命令记为通过。

## 本批实际门禁

迁入仓库后的新基础 83 项，加完整旧 death_causes／dreamer 回归，合计 133 pass、0 fail、1118 断言、7 文件。临时独立反例分别记录上节，不重复加进仓库唯一测试数。日志 `/tmp/awa-mist-foundation-root-tests.log`；临时完整候选 83／367 见 `/tmp/awa-mist-prepared/night-frame-final-unit.log`。root check、lint、format:check、diff 和后端 build 均 exit 0；共享文本包新增纯导出后完整前端 498／5014／63 文件和前端 build 也通过。无真实模型调用。本批只重跑受影响完整文件，不冒称基线 P9c 全量指纹包含新 helper；完整角色与后续阶段仍另做同源门禁。

临时日志还包括 `/tmp/awa-mist-pending-review-red.log`／green、`/tmp/awa-mist-caster-review-red.log`／green、`/tmp/awa-mist-night-review-red.log`／green、`/tmp/awa-mist-night-array-review-red.log`。范围仅基础，不能把手工 World、手填合法目标或 helper 调用当实际阶段／传输证明。

## 必须继续完成

1. 注册 profile、类型、工具、双语 DTO 及共享配置资格，保留两角色 planned 直至功能闭环。
2. 真实 NightPipeline 领取 owner、雾前置、狼聊／狼票严格失败、独立可重放雾内 RNG 和正确 WolfKill scope、额外穿透刀。
3. 直伤冻结在旧 linked 展开之前分流；PhaseManager 单独持有 Pending，在正常发言后及四自爆窗口正确领取。自爆死亡和警徽先于 Snake，救治和夜死完整后判胜；不复用旧合并 blast 的早结算路径。
4. 独立录制账本、严格 Tape、公私受众、实际双语 SDK/ACP/MCP 完整及失败局、固定 seed 和公告前后帧验证。P10 发布验收和 T6 授权保持原范围。
