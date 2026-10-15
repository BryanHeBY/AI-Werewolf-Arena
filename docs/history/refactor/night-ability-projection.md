# 夜能力投影的观察职责

本批把 `projectAbilitySource`、`projectNightState`、`projectNightAbility` 三个完整函数从能力库存模块迁到 `game/observation/night-ability-projection.ts`。实际保存 before 时的 Git 为 `53d40005e67cfbd33fb36f81c80de3f373f90759`，十八个既有文件当时与 Git 字节相同；不是最初任务消息的旧 HEAD。

## 所有权与调用边界

三函数原程序完整迁移。来源未披露时只读 kind；七种 state 各用原裁剪函数。metadata 先构造，disabled 与 status 按原位置分别查询，不缓存字段或把 DTO 当作许可。日期、来源、库存、阶段及提交仍由原机制复验。

`projectNightState` 同时供黑市转移的四处复制／完整性检查使用，保留 copy → statePolicy → 当前性重检／deepEqual 的实际位置。它不是所有内部 payload 的完整 schema，也不安装、付款或转移资源。Pair 规范化同时服务原生安装和投影，仍留共同能力 owner；`nightAbilityDisabled` 原函数仅公开为窄只读查询，status 与 DTO 共用一份 descriptor／disabled 判断，不授予权限或 lease。

真实盘点 1784 个公开 JS／TS 文件，找到四生产加十三测试、共十七个 named import 消费者。它们直达新观察叶；`agent-event-projection` 的 queries 方法契约与具体函数导入不同，整文件作为原字节控制。能力叶及三层 wildcard 上的旧三函数出口退休，不留桥。其余已有角色 state 投影出口不在本批退休范围。

本批二十源码路径包括十八旧源、新观察叶及新单元。与 Root O4 共享的 Seer 和配置实例两个测试已保存完整 O3-only 候选；之后 Root 的 provider 路由和构造参数变更单列，不算本批。类型检查采用当时汇合后的实际源码，不拿 O3 候选替换正在开发的工作区。

## 有界证明与验证

- 三实际新函数共 785 个完整节点与原定义一致；能力 owner 保留程序 1574 节点一致。完整旧模块只移除迁出声明、增加批准的 disabled 出口后，与当前 owner 两种运行输出相同，没有恢复旧整个 body 再宣称等价。
- 十七消费者共 65770 个完整程序节点，在精确导入逆向后相同；三十四份完整 ESNext／CommonJS 输出相同。四转移调用、所有回调、数组和断言保留。三个函数自身完整程序两份运行输出相同，不宣称两个完整模块或冷加载图相同。
- 后部 metadata 字段的非首子节点改值反例能被强遍历识别。十五个实际 type 擦除后的静态 backend 依赖不反向回投影叶，也不达到 ability_changes；这不是任意动态和 package 全图检查。
- 新增七例十五断言；旧精准抑制两例十三断言、原生双药一例八断言、黑市两例五断言，共十二个不同用例四次执行、四十一断言，全部通过。没有重复旧 suite。
- 首次二十根有限类型检查仅新单元有一项 readonly 预期数组／Bun matcher 签名诊断；只加擦除的类型适配，然后单个失败测试根实际退出 0，其余十九根未重复。十二个旧公开函数出口类型负例随检查验证，全部 alias 用于 tuple。
- 新测试 API directive 位置与类型 cast 的末增量不改变两份完整运行输出，已通过的七例不重跑。二十中文头、440 个实际文档路径，真实职责诊断 0，中文 presence 单独通过。

## API 与限制

新模块和公开 disabled 查询改变导出与加载边界。CJS 导出对象反射改写或替换共享 helper 后影响原局部函数引用的方式，不属于保持承诺；没有早缓存或新增绑定来隐藏该差异。真实字段读取、失败前缀、未披露源、七状态及同日药水政策保持。

本批不改角色规则、归档 shape、支付或生命周期 owner，也不把数据裁剪宣称为行动授权。未执行全量类型、全量门禁、整局、模型或网络调用；来源指纹真实变化，历史身份不回写，旧严格 Tape 跨构建兼容不扩大。

[范围与证据](generated/night-ability-projection-evidence.json) 包含真实基线、二十路径、共享候选、完整程序、导入、首次类型诊断与实际终端收据；独立源码审查由 Root 汇合提交。
