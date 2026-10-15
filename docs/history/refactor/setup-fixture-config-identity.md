# 首夜选择夹具的配置身份修复

## 范围与真实基线

基线是 B 状态职责批次已提交后的真实 Git `2da71936599900756983d4d7afb677417c66e4d2`。仅修改 Wild `model-death-and-pack-activation.test.ts` 和 Lonely `setup-and-audit-contracts.test.ts` 两个测试源，不修改任何生产判断或 B 历史证据。

原 fixture 同时持有调用方的 raw `config` 和 bootstrap 返回的 `boardConfig`。bootstrap 在装配前校验、克隆并冻结板子，两个家族安装时保存的正是这个 `boardConfig`；准备窗口要求 `config === binding.config`。原案例把 raw 对象传入，先被身份检查拒绝，尚未到达 provider 或榜样死亡流程。

## 指定输入修正

setup helper 只消费原 World、事件数组和配置，其参数类型改为这三个字段及 `ReadonlyBoardConfig`；helper 执行正文不变。三处调用显式传入 `{ ...g, config: g.boardConfig }` 这样的测试视图：Wild 原五死因循环共用一处，Lonely 原 provider 异常／晚取消案例的两个 World 各一处。

新视图保留同一 World、事件数组及其他字段引用，不克隆组件、角色、库存或生命。原 fixture 工厂及 raw config 继续保留；标题、provider、行动、死亡来源、RNG、手写预期和所有断言不改。这是合法测试输入的身份适配，实际 JS 有三处变化，不称前后运行等价。

## 有限执行与程序证据

仅执行此前失败的两个原案例，各一次：

- Wild `poison: actual model death synchronously changes faction and waits for the following actual night`：`271cd9` 退出 0，1 例、19 断言、21 过滤。
- Lonely `provider exception and late phase cancellation close original resources`：`79188c` 退出 0，1 例、5 断言、56 过滤。

合计两个不同案例、24 断言、两次执行。没有新增镜像测试，也没有重跑 B 已绿案例。B 原当前红及真实 `34239c73` 隔离旧红保持历史归属，不将它们改写为本批通过。

两根有限类型检查 `aa70cb`／session `71702`，真实终态 `44b163` 退出 0；空日志不是成功依据。两源原职责头／中文检查 `d13138` 退出 0，使用当次 641 个公开 Git 文档路径，零诊断。

唯一程序证明 `61bee3` 退出 0：9 项精确编辑全文正逆成立，逆后完整非 JSDoc 语法树 7267 节点、非注释叶 9471 项相同。31 个静态 test 标题表达式、175 个匹配器调用及原 setup provider 回调和执行正文均保持；这些是源码站点数，不是运行案例总数。仅逆三处配置输入后，四份完整 ESNext／CommonJS 输出恢复原字节；当前实际输出不同，已如实记录。bootstrap、板子参数 owner 和两家族 setup／lifecycle 六个控制源与真实基线全字节相同。

## 限制

Wild 共用站点还对应另外四种死因，本批仅执行 poison；Lonely 其他 56 个原案例未执行。其它 raw fixture 及旧 `late config changed` 对可变配置的输入不属于本批修复或通过范围。没有放宽配置身份、重新安装权威、替换原手写预期，也不宣称整个旧套件、首夜状态职责或全架构完成。未运行全门禁、模型或私有配置；不修改阶段、资源与档案政策。
