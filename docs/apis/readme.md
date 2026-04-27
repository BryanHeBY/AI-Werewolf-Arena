# APIs 索引

本目录只存放 API 相关文档（接口概览 + 协议规范）。

当前文档：
1. `api_overview.md`：当前已实现接口 + v1 迁移概览。
2. `session_rest_api_v1_spec.md`：会话生命周期 API 规范。
3. `session_timeline_api_v1_spec.md`：复盘时间线 API 规范。
4. `game_event_socket_v1_spec.md`：V3 增强版 `gameEvent` Socket 协议规范（单通道 + 增强信封 + `publicState` 规则）。

阅读顺序建议：
1. 先读 `api_overview.md` 了解当前落地状态。
2. 再读 `session_rest_api_v1_spec.md`（开局/停局/状态/结果）。
3. 最后读 `session_timeline_api_v1_spec.md`（整局 timeline / 阶段切片 / 玩家视角）。
4. 前后端联实时协议时，补读 `game_event_socket_v1_spec.md`。
