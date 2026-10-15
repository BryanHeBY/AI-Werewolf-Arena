# 退出未消费的领域兼容出口

基线是实际 `64479b4c39da619ce0e7b3817e78e0e8b792c6a0`，包括已提交的 WinSystem 中文说明。三源范围：删除 `registries/phase_registry.ts` 和 `systems/win_condition_system.ts`；`core/domain/index.ts` 仅移除两条重导出并改写有效中文职责头。其余 21 条出口的原文本、目标、绑定路线与排列顺序保持。

## 当前消费者与真实职责

公开 workspace 的 TS／TSX／MTS／CTS／JS／JSX／MJS／CJS 共 1948 源，含源码、脚本、测试、tooling；公开文件枚举 3909 项（其中 3904 文本文件）。AST 采样最初是 a020 HEAD＋待提交中文六源，随后逐 Git blob 字节绑定到 64479b4c，全源码 digest 相同。三个 barrel（domain、core、backend）有 853 处导入、531 个消费文件，没有取这两个类的具名／类型／物理叶入口。唯一非字面动态入口是 `trace-game`；其 `core` namespace 只读 `createRandom`，不枚举或反射这两个出口。两声明、两 reexports 之外，仅现行中文批 MD 有三条范围说明。历史 generated 库存／图／台账引用保留原字节。

PhaseRegistry 只复制阶段顺序数组，三个方法没有真实调用。WinConditionSystem 只保存注入评估器并委托两个实参，没有实例创建或使用。实际阶段与 await 仍归 PhaseManager／三个 pipeline；开局仍创建 ConditionRegistry，终局条件、覆盖和封盘仍归原 registry／terminal policy／经理。这次不移动任何真实玩法算法。

## 公开 API 与加载边界

退休的是两个类、三个公开 barrel 的相应名字、两个旧物理模块路径以及构造／方法 API。根 package 是 private workspace，backend 仍有 `dist/index.js` 公共 main 与声明输出；未知外部消费者未被证明不存在，不能承诺无兼容影响。没有新 wrapper、服务或默认桥。

旧叶真实 ES/CJS 转译已保存：Phase 的 model 依赖在原 domain 首条出口已先进入加载链，数组复制和默认 Phase 值只在构造／调用时执行；Win 的三个类型用途 imports 被擦除，输出仅类、委托定义与 CJS export bookkeeping。没有旧叶顶层 World 创建、时钟读、规则登记或阶段推进。保留出口的实际依赖初始化仍执行；删除改变 namespace keys、模块／声明图和入口真实 JS，不声称任意反射、CJS monkeypatch 或冷执行环境等价。

两个删除路径与入口中文头都属于 engine-fingerprint 的 backend/src 原始路径／字节范围，新构建会生成新的 sourceHash。本批不重写历史档案身份、不更改严格复现校验或加兼容豁免；没有执行 fingerprint 或 strict replay 来假称全机制验收。

## 一次有限验证与真实红灯

- 单入口根使用原 backend 严格选项及真实依赖 closure。首 `07d994` exit 2 缺原 ambient 搜索目录；第二 `829589` exit 2 错把整个 node_modules 当隐式类型根。两原配置／原 stdout 保留，仅失败同根配置收回原 backend `@types` 目录（node／nock）后 `61cca8` 真 exit 0，生产源未改。
- 中文职责头单根 `656bf6` 首 exit 0，714 同 Git MD 路径、0 diagnostics；没有重复已绿头。
- 完整入口三编辑精确正逆。首 `94d114` 工具把空行当唯一恢复锚而红，保原脚本／输出；仅比较器改为完整邻行锚，`03e866` 真 exit 0。双侧累计 112 typed nodes、6 NodeArray、54 AST 叶和完整非注释 token 对照；精确逆两份 emit 相同，入口实际两份 emit 不同。旧两叶四份实际转译用于顶层范围核查；五完整控制同字节。
- 解析审计首 Node 脚本 CommonJS `exports` 名冲突和后续 host Git EPERM 均有阶段记录；Bun parse-only `607d69` 首成功，不加载应用。没有业务测试、全类型、生产加载、冷执行或架构全门禁。

源码在 ready 后未再改变。附件与当前源码／删除 SHA、控制、MD 绑定于同 prefix 的 scope/evidence；作者自审与独立非作者审批不计入附件列表，避免循环摘要。这只收口两个无活跃消费者的 C44 兼容出口，不代表 55 机制／中文／P9 全部完成。
