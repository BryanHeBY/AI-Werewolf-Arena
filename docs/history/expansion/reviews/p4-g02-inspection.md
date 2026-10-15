# P4 G02 类型化查验子批交叉审查

## 范围与证据

共享InspectionResult、纯标签查询、原生Seer的camp-only事件/state、完整结果的提示/终端/复盘/视频标签、legacy解码与玩家投影隔离。详见[查验契约](../inspection-results.md)。能力来源/资源/生效/调度、女巫正确性与G03–G04继续后续，没有将57计划角色或M05/M07/M08整项标完成。

- 最终后端发布门槛449测试、29877断言、81文件；类型/deps/边界/i18n扫描/test/smoke全部通过，日志 `/tmp/awa-p4-g02-inspection-release-complete.log`。
- 含34实际SDK/ACP/混合双语六/十二人整局及逐局严格Tape复现。模型服务全部为合成本机服务，没有用户认证或外部模型调用。
- 专项28测试、3346断言，日志 `/tmp/awa-p4-g02-inspection-recheck.log`：真实Seer阶段、字面六/十二完整oracle、结果种类/三阵营/标签与实际身份分离、actor-only、历史/summary/投影副本、旧值及getter/Proxy反例。
- 前端52测试、360断言、类型及构建通过，日志 `/tmp/awa-p4-g02-inspection-front-{final,type-final,build}.log`。新结果标签共用于时间线/逐帧画面，没有把unit/type/build证据当作新增真实视频渲染或浏览器E2E。
- 最后英文措辞按R/L建议把“complete result.kind”改为“complete result according to result.kind”；仅文本精度，无API/规则变动。定向文本/双语提示9测试、1581断言通过，日志 `/tmp/awa-p4-g02-inspection-text-final.log`，没有为该措辞重复完整门槛。

## 独立审查、修正与复查

| 审查者                     | 首轮发现                                                                            | 根修正与最终状态                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A / review_arch_tests      | decoder校验与返回重复读取unknown属性，getter可使返回不满足InspectionResult          | own data descriptor快照验证，不执行getter、不读取继承，Proxy异常未知；补changing getter/继承/throwing与revoked Proxy反例，复查关闭 |
| A / review_arch_tests      | 新nested result经浅投影与领域事件共享，只有请求DTO的provider可改写权威事实          | 投影structuredClone整份payload；实际Seer投影改动不影响event/latest/history/summary，公票据nested也验证，复查关闭                   |
| R+T / review_scope_rules   | terminal旧值truthiness与严格reader/文档不一致：null/缺字段猜good，字符串false猜wolf | 终端同用shared decoder，null/unknown保持原JSON、不合法bool/缺失显示?；两語四反例通过，复查关闭                                     |
| L+D / review_i18n_delivery | typed/legacy优先级、三结果两语、原文、版本与API范围                                 | 没有契约阻断；核对renderer一致、producer camp-only、旧private可选及source不放宽；英文最后措辞建议采纳                              |

A独立最后13测试/199断言通过。R独立20测试/3279断言及前端3项，修正后核对根28/3346且未重复完整门槛。L独立最后后端13/199、前端4/24通过；最后system文本两语与R共同复查0阻断。没有把根完整矩阵当成审查者重复执行。

三路最终0剩余阻断。Role/combined是受控基础查询/数据契约，当前模型输入schema没有mode参数；Seer领域事件及summary强制camp-only。真实角色自己的伪装/反查/第三方规则仍需对应规则卡与执行场景。目录仍7已实现、57计划。
