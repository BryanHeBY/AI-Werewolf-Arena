# 已付摄梦场景的合法板子装配

本笔只改 `tests/scenarios/features/radiant-eclipse/paid-dream-effects.test.ts`，基线为真实 `37f56392322fdfa859b0d674f339693e0ca883ff`，已经包含摄梦关系所有者及狼术师验证迁移。生产源码与公开板子文件均未改。

旧测试把空 `roleSetups`、禁用警长和不完整固定政策强转成 BoardConfig。已交付的有限准入会在开局报 `radiant_eclipse_preset_invalid`，还未到已付摄梦；旧 Git 隔离探针 `405ac8` 和 Dream 首阶段红收据继续保留，未重复它们或改写历史结果。

本笔仅用公开 `configs.example/boards/awa_radiant_eclipse_12_v1.json`，通过真实 `parseBoardDefinition(...).config` 取得完整阵容／警长／角色与机制政策。新增测试模块内的公开文件读取／解析 I/O 及输入路由明确，是过期测试装配修复，不能叫旧无效输入与新合法输入行为等价。

原12人的顺序与身份、手写前夜梦历史／药瓶余量、角色安装、provider、Stages、三个原 case、同一错误和全部状态／事件 oracle 保留。没有重建整份 fixture、绕过 owned 配置、放宽生产谓词或生成新的预期。

## 实际验收

- 原3个场景各只运行一次：`2d2dae` 实际退出0，**3 通过／0 失败／30 断言**。合法配置没有暴露其他库存装配缺陷，无失败重试。
- 一个 fixture root 类型检查：session `47887 → fef5e9` 实际退出0。日志为空不能替代真实退出收据。
- 精确四处导入／类型／配置／中文头变更逆回实际原文：完整程序1340 AST节点、全部语法叶及两份逆接线后的 ESNext／CJS 输出同；20条静态完整 expect 链、2个标题声明（参数化产生3case）、6个 fixture／stage 方法保持。
- 6个原字节控制源为公开JSON、真实解析器、Pipeline、庇护权威、摄梦关系owner与原Frame。首次证明工具错误地单独解析method片段，保留报错；仅补合法class容器并完整核断言链，未为证明改源码或重测试。
- 单源真实职责头／中文检查 `c5a1fc` 为零诊断，输入使用当时488个跟踪文档路径。中文说明明确配置输入、固定库存历史及独立oracle。

本笔不运行其它测试、全类型／全门禁、整局／复盘或模型，不改 production、seed／golden、历史归档或 progress，不自行提交。

[冻结源码](generated/paid-dream-fixture-scope-final.json) · [证据与真实收据](generated/paid-dream-fixture-evidence.json) · [完整源码对照](generated/paid-dream-fixture-proof.json)
