# 本机控制监听器所有权检查

状态：测试基础修正；不增加角色，不关闭 P9d／P10。

## 首轮全量失败证据

基线 `5673ca1`、候选目录仅将迷雾双角色标为 implemented。实际首轮分片合计 **5500 pass、5 fail、1 skip、382 唯一文件、583253 次断言**；尚未运行七个串行时序文件、smoke、前端、构建及 Chromium。日志在 `/tmp/awa-p9d-mist-accepted`，不将此轮记为全量通过。

- `mechanical_configuration.test.ts` 两项直接 bootstrap 错误预期遗漏了 Alchemist／Raven 的 `mist_raven_preset_invalid`，整文件串行仍为 40 pass／2 fail。公共配置 parse 的 `board_config_role_combination_not_supported` 已正确，生产错误优先级保持。
- 魔术师、杠精和孤独少女三份 ACP 用例的旧 TCP 探针收到 connected；三份整文件串行重跑分别 6／18／36 项通过。独立受控实验确认端口可被新控制实例复用，但没有逐例证明首次三个失败都是端口复用，根因不倒写为已确认。
- 原 driver 起始指纹只覆盖 1595 项，漏掉实际 ruleCardRef／formatter 的文档输入。A 独立 sidecar 补 234 项（233 docs 与 README），前后相同且与基线 HEAD 字节一致，哈希 `1bf2a57f9f1c7169096e4abc74d3e3bf600338a3ad39776cc763265aaf7bdb31`。首轮失败后的源码复查已经包含新补丁，不能称整个首轮所有源码前后同指纹；这些限制与原始日志一并保留。

## 判定与资源边界

测试 fixture 保存同一次注入配置的 URL 和随机 token，文件为 0600；只用于短期本机合成会话，无宿主认证读取。初始化期间真实 MCP `get_game_schema` 校准鉴权：session/new 回执前尚未 bind，精确 `{ok:false,error:"session_not_ready"}` 合法；其他错误（尤其 unauthorized）失败。收尾检查的 409 则必须失败，二者时点不同。

收尾只发一次直连 `node:http` POST `/invoke`，携带原 token，以 `agent:false`／Connection:close 避免代理与复用连接。明确区分：

- ECONNREFUSED：地址没有监听器，结果 `closed`。
- HTTP 401 且 `{ok:false,error:"unauthorized"}`：在当前每实例固定随机 token 不变的生产契约下，地址由其他所有者占用，结果 `reused_by_different_owner`；不声称地址无人监听。
- 200／400／409／404、重定向、错误或非 JSON、超时、异常断连：失败，不能掩盖原所有者泄漏或未知状态。

4096 字节响应上限、总超时一秒，所有路径清理 timer、销毁请求并等待关闭。原 Agent／MCP PID 的 ESRCH 和 runner 零 pending／sessions／creating／retiring 断言保留。两条 harness 返回路径均移除 token；公开 replay／前端 fixture 不导出此临时鉴权值。生产协议与鉴权代码没有修改。

## 交叉审查与定向回归

- root 的 probe／机械配置 **54 项、159 次断言、零失败**。probe 的 12 项覆盖原 listener 已绑定 200、未绑定 409、真正关闭、强制同端口新实例与新旧 token、错误响应、body 上限、挂起和 reset、socket 回收。
- 校准修正后 root 的迷雾、魔术师、杠精和孤独少女整文件回归 **72 项／41787 次断言／零失败**，两语真实 SDK／ACP／mixed；日志 `/tmp/awa-mist-owner-probe-transport-fixed.log`。
- R 独立机械契约 2 项／6 次断言通过；原测试两项稳定红保留。独立旧杠精 ACP 双语整局 1 项／248 次断言通过。
- T 独立 probe 与旧机械狼 ACP 双语通路 **13 项／307 次断言通过**。
- 初版新增校准错误地拒绝初始化的合法 session_not_ready，root 的真实通路定向出现 ACP 失败后停止；日志 `/tmp/awa-mist-owner-probe-transport.log` 保留。修正精确错误白名单后由 R、T 复查，不把这次失败隐藏在绿色记录中。

原审查者复查当前补丁未发现剩余可复现 P1／P2。接续新的完整公开输入指纹与同源门禁，成功／失败出口都采 after；不覆盖首轮失败目录，不拿定向回归冒称全量通过。
