# 玩家事件投影：统一纯数据副本边界

本切片修复三路审查期间复现的既有信息投影问题，不改变玩法规则、机器字段、历史受众或规则版本；角色计数仍 44/64。前置迷雾运行切片为 `5faf725`。

## 证据与修复

A 独立复现 17 个字段 canary 及 4 个授权变更反例：事件 reader 已复制描述符后，外来 Proxy 回调改变原 payload、actor、type 或 audience；后续 visibility／projectPayload 再读原对象，导致校验与输出指向不同事实。涉及 Scholar、Consort、WolfSorcerer、Trickster、Prince、Cupid、Debater、Nightmare、GhostBride 和公开映射／空枪事实。原日志 `/tmp/awa-event-feed-reread-review-red.log`（17 red / 1 green）与 `/tmp/awa-event-feed-authority-review-red.log`（4 red）保留。反例针对对象 API 边界，不表示模型通过正常工具可以创建 JavaScript Proxy。

`buildAgentVisibleEvent` 在读取事件字段前校验整个 own data 图为普通对象／数组，无访问器、Proxy、符号、循环、函数或非有限数值，然后复制一次 inert envelope。后续 reader、权限判断和既有投影都只读取这个副本，保留既有裁剪及历史受众。可选 undefined 字段仍按原未序列化语义保留；JSON wire 的缺省不改变。声明的事件嵌套、数组和原生来源以现有实际对局回归核对，没有新增注册表或权限框架。

更早的 Proxy 拒绝使原反例的 trap 次数由 2／4 变为 0。维护测试显式核对这个新边界及 null 输出，不伪称带原“必须执行攻击回调”预期的原文件直接全绿。原四个授权反例保持隐私预期。Mist 嵌套 Proxy 回归也收紧为零 callback、直接拒绝；正常 plain fact 仍使用 detached payload。

## 验收

A 原授权 4 例不改、字段反例 v2／Mist 对照合计 **22 pass / 58 断言**；既有 feed／wolf_team 历史兼容 **46 pass / 341**；冻结、null-proto、undefined 与裁剪独立样本 **4 pass / 11**。日志 `/tmp/awa-event-feed-{inert-review,compat-review,inert-compat-review}-green.log`。R 两段真实 World 的 **121 事件 / 4618 断言**覆盖延迟夜死、梦连锁、猎人→狼王枪链和解封知识；T 17 结构样本、7 类零回调外来位置及实际两夜终局复验通过。最终同源 engine/config **2985 pass / 0 fail / 28163 断言 / 158 文件**，用时 95.35s，日志 `/tmp/awa-event-snapshot-engine-final.log`。root check（两端与后端测试类型）、lint、format:check、后端 build、git diff --check 均 exit 0：`/tmp/awa-event-snapshot-{check-final,lint,format-check-final,build-final}.log`。本批没有前端实现变更；前置切片前端 528 项与构建证据保留，不称重新执行浏览器。局部 visibility＋Mist 投影 57 pass、0 fail、502 断言、5 文件，日志 `/tmp/awa-event-snapshot-tests-1.log`。新增维护文件包括 21 攻击场景、Mist 对照及普通字段裁剪／历史授权／可变源脱离、访问器与循环拒绝。

本切片不替代 Mist/Raven 的独立录制账本、真实通信、多种子或浏览器验收，也不改变已接受的 P9c 基线证据。

首次完整 engine/config 2984 pass / 1 fail（`/tmp/awa-event-snapshot-engine.log`）：25 种子 × 3 交错完整十二人局的确定性测试在 5184ms 超过 Bun 隐式 5000ms。该测试没有性能预算契约；明确给这批 75 局设 20000ms，不改变种子、自然结束、交错或事件等价断言，后续同源全量重新验收；原失败日志保留。测试类型门禁还修正了测试使用宽 GameEvent 联合后直接修改 targetId 的类型，改为明确事件分支。P10 资源／延时验收仍独立完成，不能用提高确定性批次时限冒称性能通过。
