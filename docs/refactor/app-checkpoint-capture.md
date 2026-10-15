# live checkpoint 读取归应用装配

以 `a55e675be1d607825188038ae737c4b90a0e6113` 为实际 Git 前态，将五个完整模块从 `recording/reproduction/checkpoint` 移到 `app/checkpoint`：

- `contributions.ts`：装配既有准备结果与贡献。
- `authority-snapshots.ts`：读取三种专属权威及原录制游标。
- `identity-setups.ts`：读取婚约、孤女及两种初身份 setup。
- `player-snapshots.ts`：选择并构造真实玩家快照。
- `private-state-codec.ts`：按既有优先级选择、复制真实私态。

这些模块读取 live World 和具体机制；应用层已有唯一 `captureCheckpoint` 调用点，适合拥有这组装配。纯 checkpoint 格式、schema 和数据审计继续放在 recording。没有新增注册表、状态、回调层或兼容壳。

七个完整程序只改变 33 个模块字面，保留 52 个真实绑定对应、重复 getter、克隆时点、nullish 短路、Demon／Animal 专属优先及失败前缀。两个外部消费者原位接线，Trace 七个入口无需变化。五模块中的 16 条 features 依赖随原实现归 app，自然消除这组 recording 反向依赖；没有放宽检查器。

Root 以新 Git 重捕完整前态后，首次应用及证明通过：七个目标规范化的 typed AST／NodeArray／token／ESNext 输出一致，十四个完整逆向输出相同。全后端既有路径边界扫描首次通过。准备方案已由作者、Root 与非作者交叉审查；末范围另作真实 SHA 核对。

本批只改归属与引用，没有运行对局或新增业务测试。类型、整局及最终全门禁按大阶段汇合执行，不能把这次静态检查当成全部玩法验收。两处旧中文角色称呼留给后续注释精度批。
