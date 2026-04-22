# Session Replay Recording V3 开发驱动

来源规范：`docs/specs/backend/evolution/observability/session_replay_recording_v3.md`

## 任务
- [x] `SR01` 录盘模块与类型定义。
- [x] `SR02` 接入 `run_llm_game.ts` 写 `manifest/public_timeline`。
- [x] `SR03` 接入 `llm_action_provider.ts` 写 `players/player_<id>.json`。
- [x] `SR04` 接入阶段流水线与校验层写 `logic_ops.json`。
- [x] `SR05` 写盘失败降级告警。
- [x] `SR06` 覆盖目录结构与字段完整性测试。
- [x] `SR07` 输出 `phase_windows.json` 与 `timeline_index.json`。

## 验收
- [x] `SA01` 产物目录完整。
- [x] `SA02` 公共时间线覆盖关键事件。
- [x] `SA03` 玩家 timeline 顺序与字段约束满足。
- [x] `SA04` `logic_ops` 含校验与结算操作。
- [x] `SA05` 写盘异常不阻断主流程。
- [x] `SA06` 阶段窗口与 `seq` 对齐且单调。

## 验收证据
1. 录盘核心：`backend/src/observability/{session_record_manager.ts,types.ts}`
2. 事件与广播接入：`backend/src/runtime/run_llm_game.ts`（`recordPublicEvent`/`recordPlayerBroadcast`）
3. 玩家回合接入：`backend/src/ai/agents/llm/llm_action_provider.ts`（`recordPlayerRound`）
4. 逻辑操作接入：`safeRecordLogicOp(...)` 已接入 `phase_pipeline`、`action_validator`、`llm_action_provider`
5. 实际落盘样例：`backend/data/records/session_1776184109404_602wh2/`（含 `manifest/public_timeline/logic_ops/players`）
6. 测试证据：`cd backend && npx jest tests/v3/session_recording.test.ts --runInBand`（通过，10/10）
7. 新增产物：`phase_windows.json`、`timeline_index.json` 已接入 `writeInitialFiles/flush/finalize` 全链路。
8. 写盘降级：`writeJson/writeText` 捕获异常并告警，`session_recording.test.ts` 新增写盘失败不阻断用例（通过）。
9. 阶段窗口：`recordPublicEvent` 支持 `stage`，并由 `run_llm_game.ts` 注入 `toReplayStage(...)`，`phase_windows` 保证按 `seq` 单调推进。
