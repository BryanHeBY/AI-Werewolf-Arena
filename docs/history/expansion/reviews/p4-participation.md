# P4 公共参与资格与警长交叉审查

## 范围与证据

RoleProfile/RoleCatalog公共资格、白痴一次翻牌、不能再投票/被放逐/竞选/拿徽、共享接收与最终规则/流水线/Baseline/提示；警长空报名/全退/零票/候选不得投票、非法票不改投、跨await再验与候选副本。契约见[公共参与](../public-participation.md)。三个扩展自爆窗口与G04仍继续，计划角色未启用。

- 人工16测试/156断言，日志 `/tmp/awa-p4-participation-targets.log`；真SDK HTTP/MCP两语拒绝连既有25/284，日志 `/tmp/awa-p4-participation-wire.log`。
- 初步engine/shared/prompt185/5282通过，日志 `/tmp/awa-p4-participation-baseline-fixed.log`。首次回归唯一失败是旧方向测试依赖无人上警自动选出警长；已给该正向测试明确上警和有效票，继续核对counterclockwise座位顺序，不放宽断言。
- 前端54/365与类型通过，日志 `/tmp/awa-p4-participation-front-{tests,type}.log`；没有新增事件字段或画面组件，未重复E2E/视频渲染。
- 最终完整release563测试/31339断言通过（type/deps/边界/i18n/test/smoke），日志 `/tmp/awa-p4-participation-release.log`，含34真实SDK/ACP/混合两语六/十二基础完整对局及逐局严格Tape。全部模型通路为合成本机服务，没有外部模型或用户认证。

## 独立三路审查

| 审查者                     | 关注方向                                                      | 结论                  |
| -------------------------- | ------------------------------------------------------------- | --------------------- |
| A / review_arch_tests      | 查询贯穿/注入catalog、最终校验、候选副本、跨await、资源与API  | 独立17/159通过，0阻断 |
| R+T / review_scope_rules   | 冻结白痴与空候选/零票/退水/平票，公开资格不用于秘密免疫       | 独立16/156通过，0阻断 |
| L+D / review_i18n_delivery | stablecode/中英规则、空候选输出、低层API/旧档、提示与公开约束 | 独立18/159通过，0阻断 |

三路最终0剩余阻断；不把公开资格查询用于未来秘密抗性。
