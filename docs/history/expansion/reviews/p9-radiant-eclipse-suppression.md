# P9d 猎日逐光：原生临时封禁所有权

基线 `6ea94a2`。本切片新增有限 `nightSuppression:{policy,day}` 与原实例封禁 owner，共享能力状态、枚举／Gateway 和玩家投影识别该槽。没有自动夜租约、借用 grant、角色 profile、阶段或配置启用；两角色仍 planned，目录仍 **46/64**。

## 资源与授权

封禁是与持久 `disabled` 分开的原因。`abilityStatus` 将存在的 blocker（包括畸形或 getter 槽）视为禁用，不执行该槽 getter；投影的 effective disabled／status 一致，公开类型与逐字段投影排除内部 marker。没有 marker 的旧角色路径保持原语义。

打开时先检查原 factory Alive 描述符，再读取生命；拒绝 Proxy／非普通能力原型，用 own data descriptor 安装可序列化 marker，不触发继承 setter。行动授权同时绑定原角色／容器／能力／状态／来源／身份与原生命、marker 引用、policy/day 及精确可枚举描述符，任何漂移撤权。

关闭独立检查**清理所有权**：原 Role、privateState、能力容器原槽仍为同一实例，原生命未替换／复活（允许首次真实死亡），且 marker 仍为自己持有的对象。删除本原因，永不回写持久 disabled；同值外来 marker、新能力、新生命和复活不清理。名字、camp、state/source/id 等授权元数据漂移不会阻止清除原资源的自身标记。关闭幂等。

## 三路修正与维护判例

- 草稿阶段 T 的访问器副作用、marker 不可枚举导致 checkpoint 丢失两个反例已修；原五项脚本纳入维护测试，先验 factory descriptor、canonical own slot 与 marker 检查保持。
- 本阶段 R／A／T 共同发现初版 close 复用严格行动资格：改名字或换 state/source 等会撤权，却留下自身 marker 造成后夜封禁。现分离 sameResource／sameInstance。原独立脚本输入未改，A **6/25**、T **4/23**、R **8/40** 均绿；原红日志在 `/tmp/awa-radiant-suppression-a-review-red.log`、`/tmp/awa-radiant-owned-marker-delivery-review-red.log` 保留。
- 维护 26 项覆盖原禁用／新增禁用、字段变更、foreign 同值 marker、首次死／复活／替换生命与能力、九种元数据漂移、descriptor／访问器、序列化与真实 ToolGateway 封禁／恢复、公开状态不泄漏 marker。

相关原生状态／Dream／NightAbility 回归共 **87 pass／0 fail、775 次断言、5 文件**，`/tmp/awa-radiant-eclipse-suppression-tests-final-backend.log`。backend src／tests 类型、root lint、目标格式及 diff 门禁通过。最初测试将 Seer 实例扩成 NightAbility 联合，导致 matcher 类型错误；改为保留窄类型，类型检查重新通过。测试曾在根目录使用 backend 相对路径而未进入测试，正确 cwd 的完整五文件结果单独保留，不混算。

本次确有共享能力状态／DTO 的生产代码变更；生产中仍没有调用 open owner 的地方，不称零生产改动。有限板资格、原生 kind／复制来源合法性、phase／库存晚校验、正常／aborted 到期关闭、已提交伤害和独立 Tape 由后续 Frame 与夜流程实现。当前测试不替代完整租约、空借药零请求或角色技术交付。
