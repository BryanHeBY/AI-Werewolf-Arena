# P9b 噩梦之影有限板验收

日期：2026-10-10。范围：AWA 十二人噩梦摄梦板，四个具名策略组合。最终冻结门禁通过；本记录不表示用户总体验收通过。

## 规则与实现

- 沿用目录 ID nightmare、模块 nightmare_shadow，所有玩家文本统一 role.nightmare 前缀。
- fearActionPolicy optional / required_when_legal；wolfActionPolicy standard / no_blast_no_self_knife。默认 optional × standard。
- 恐惧先于所有原生夜间行动；首夜提交前不互认狼队，提交后互认；此后不能恐惧狼队友。
- 被恐惧的 Seer/Witch/Dreamer 不请求、不消费、不追加本夜技能记录；狼目标封全队刀但保留狼聊；Hunter 夜死禁枪、昼间放逐可枪。
- 明确弃用与缺失响应严格区分；同目标不可连续，弃用或摄梦被跳过不会伪造动作历史。
- 私有 fear 事实只对本人及 God 可见；本人投影仅 day/targetId，不泄露阵营或封刀结果。
- 生命与角色原实例/权限绑定，正常首次死亡保留已提交效果；替换、复活、过期请求不得借用旧授权。
- 十二人固定原生牌组，不承诺任意扩展混搭；见[规则卡](../../rules/awa-nightmare-dreamer-v1.md)。

## 可复现专项证据

- backend/tests/engine/rules/nightmare_shadow_state.test.ts：18 个状态测试。
- nightmare_shadow_frame.test.ts：9 个逐夜/生命授权测试。
- nightmare_shadow_runtime.test.ts：24 个中英实际周期、多夜、猎人枪、自爆工具供给和摄梦隔夜测试。
- nightmare_shadow_facts.test.ts：13 个严格事实与标签测试。
- nightmare_configuration.test.ts：4 个公开配置往返与 10 个非法配置拒绝。
- backend/tests/ai/agents/nightmare_observation.test.ts：2 个首夜未知队友、本人隔离/不可变及实例 map getter 回归。
- backend/tests/runtime/nightmare_observed_simulation.test.ts：4 板 × 2 语言 × 20 seed，共 160 局自然结束、零 fallback；每局 strict Tape 与三种篡改拒绝，8 项测试 / 824 次断言。
- backend/tests/integration/nightmare_game_execution.test.ts：3 种真实本地 SDK HTTP / ACP 子进程 / mixed 通路 × 双语，共 6 局；3 项 / 1722 次断言，逐人私有导出及双语结果/checkpoint 一致。未调用付费模型。
- backend/tests/runtime/nightmare_required_failure.test.ts：missing / late × SDK/ACP × 双语，共 8 个严格失败场景；4 项 / 161 次断言，partial Tape 未完成 checkpoint、错误决策且无恐惧提交/夜结算/胜利事件。
- frontend/tests/unit/replay/nightmare-facts.test.ts：11 项 / 12 次断言。
- frontend/tests/e2e/nightmare.spec.ts：2 个真实 Chromium 中英回放；输入来自实际成功 transport 输出，恐惧时 12 席存活无赢家，终局 6 席死亡、8 位赢家。

## 已修复问题

1. canonical role ID 与 brief 文本键不一致，真实传输暴露缺键；统一为 role.nightmare。
2. reproduction audience 白名单遗漏，所有整局录制失败；严格允许本事件并要求唯一受众等于 actorId。
3. 禁自爆变体仍收到自爆请求；请求构造前查询动态权限，普通狼行为不变。
4. 自身投影使用可覆盖的 history.map；改用内建 map 并复制白名单字段，实例 getter 抛错回归通过。
5. 传输夹具旧狼列表遗漏 nightmare，及首夜警长报名/死亡公布字面顺序错误；根据实际契约修正夹具，保留全部泄漏与严格顺序断言。

## 最终门禁

后端四分片合计 4180 项零失败，执行前后源码与测试指纹一致。前端完整单元 412 项零失败；check、lint、双端构建和格式检查通过。完整 Chromium 196 项零失败（单 worker、零重试）。早先发现性全量记录 497 pass / 3 个旧夹具失败后主动中止，仅为诊断记录，不能计作通过。所有源码和测试必须以最终指纹验证为准。

此前 /tmp 独立 tmpfs 耗尽导致后端和浏览器运行中断，日志仅为失败证据；迁移产物后改用硬盘专用临时目录。浏览器第一次硬盘重跑因 Unix socket 路径过长启动失败，缩短临时路径后重新验证，失败批次不计作通过。

最终后端证据来源：v2 四分片完成后仅旧机械狼组合错误码断言失败；修正 Nightmare 专用错误码后，v3 完整重跑分片 2，复用源码与测试指纹未变的分片 0、1、3。最终汇总不是四片全部重新运行，原失败和复验日志均保留。
