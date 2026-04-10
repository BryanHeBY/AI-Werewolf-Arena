# development activity driver

## 1. 当前代码详细文档

本文件定义 V3 后续开发活动的执行驱动，适用于后端优先重构阶段。

活动目标：

1. 按 `docs/specs/backend_architecture_whitepaper_v3.md` 作为后端唯一技术规范推进实现。
2. 按 `docs/specs/v3_mvp_requirements.md` 作为当前里程碑验收清单推进交付。
3. 所有实现先更新 `docs/guides/*` 任务状态，再改代码并补源码中文注释。
4. 后端重构期间以 `docs/guides/backend_rebuild/*` 作为任务分解与推进主看板。
5. 在每次关键里程碑前执行真实大模型连通测试（读取项目根目录 `.env` 中的 Minimax `OPENAI_*` 配置）。

标准开发节奏（每个任务都执行）：

1. 需求对齐：在白皮书/MVP 中定位条款与边界。
2. 影响面分析：在 `backend/src` 与 `frontend/src` 源码注释中确认涉及文件、导出项、依赖项。
3. 设计落文档：先更新相关文档中的 TODO 与验收标准。
4. 小步实现：按模块提交（core / ecs / agent / server 分层推进）。
5. 回归验证：补充或更新测试，再进行最小回归。
6. 文档回写：同步更新变更文件的 codebase 文档与 guides 状态。

建议开发顺序（V3 后端）：

1. ECS 数据层（Role/Camp/Alive/VotingRight/StatusMarks）。
2. PhaseManager 串行流程（day/night/vote + hooks）。
3. Tool 网关（校验、错误反弹、重试）。
4. 事件总线拦截（白痴、猎人、自爆中断）。
5. 服务层协议对齐（socket/broadcast）。

当前执行基线（2026-04-08）：

1. 已落地目录：`backend/src/{app,domain,engine,gateway,memory,scenarios,v3}`。
2. 已验证命令：
   - `cd backend && npx tsc -p tsconfig.v3.json --noEmit`
   - `npx jest backend/tests/v3 --runInBand`
   - `npx tsx backend/src/run-test-v3.ts`
3. 已切换为 V3 单栈：`server/index.ts` 已接管，V2 目录已清理。
4. 下一开发焦点：扩展白皮书角色库与高级机制（警长流转细化、更多角色技能链）。
5. 真实模型连通测试约束：`OPENAI_BASE_URL/OPENAI_API_KEY/OPENAI_MODEL` 必须由 `.env` 提供，禁止在代码与文档中硬编码密钥。

最近修复同步（2026-04-09）：

1. `backend/src/v3/llm_action_provider.ts`：增强 `<think>` 非 JSON 恢复解析；同时新增发言污染过滤，防止 `actorId=`、`allowedTools=`、`context=` 等提示词元信息泄漏到玩家发言。
2. `backend/src/scripts/run_llm_game.ts`：新增实时事件流与上帝播报；已撤回 `revealPrivateEvents` 需求改动，恢复统一日志输出。
3. `backend/src/engine/phase_pipeline/night_pipeline.ts`：补充夜间行动细节事件（守卫、狼刀投票、女巫用药、预言家查验）。
4. `backend/src/engine/phase_pipeline/voting_pipeline.ts`：补充逐票事件 `vote_cast`，支持法官视角回放。
5. 本轮回归命令：
   - `cd backend && npm run build:v3`
   - `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts`
6. ANSI 彩色日志增强：
   - 新增 `backend/src/utils/ansi.ts` 统一管理 ANSI 颜色输出与开关。
   - `run_llm_game.ts` 支持 `--color true|false` / `V3_COLOR`，按日志类型着色（上帝、行动、告警、错误、终局）。
   - `llm_action_provider.ts` 的 trace 日志按状态分色（start/ok/recovered/timeout/transport_fail）。

## 2. 开发任务清单

- [x] `T01` 在 `backend/src/engine/phase_pipeline/day_pipeline.ts` 实现 4 类 Action Window 与可配置开关。
- [x] `T02` 在 `backend/src/engine/phase_pipeline/night_pipeline.ts` 实现狼队战术环与夜间优先级结算。
- [x] `T03` 在 `backend/src/engine/phase_pipeline/voting_pipeline.ts` 与 `domain/world.ts` 实现警长竞选、票权加成、移交/撕毁流程。
- [x] `T04` 在 `backend/src/domain/components/*` 完成组件拆分并更新 `backend/src/domain/model.ts` 聚合导出。
- [x] `T05` 新增真实大模型连通测试入口（建议：`backend/tests/v3/minimax_live_connectivity.test.ts`），在 `RUN_LIVE_LLM_TEST=1` 时读取根目录 `.env` 的 `OPENAI_*` 配置，对 Minimax 发起最小可验证调用（至少包含 1 次模型响应，优先包含 1 次 tool schema 往返）。
- [x] `T06` 重构 `run-test-v3` 运行入口：将 mock 回归与真实 LLM 对局分离为独立脚本（如 `run_mock_game.ts` / `run_llm_game.ts`），并将默认 `run:v3` 指向真实 LLM 对局入口。
- [x] `T07` 收敛真实运行日志中的非结构化回复噪声：当模型返回 `<think>` 或非 JSON 文本时，统一记录为“recovered”而非“failed”，并确保 fallback 可稳定推进完整对局。
- [x] `T08` 修复 `LlmActionProvider` 恢复解析回归：当模型返回结构化 JSON 但工具不在 `allowedTools` 中时，必须严格 fallback，禁止被“文本恢复”逻辑改写为合法工具。
- [x] `T09` 修复 `run_llm_game.ts` 新增输出参数后的编译回归：补齐 `run_llm_dual.ts` 对 `RunLlmGameOptions` 的新字段传参，恢复 `build:v3` 可通过。
- [x] `T10` 修复“发言污染”：恢复解析产出的 `speak` 文本不得包含提示词元信息（如 `actorId=`、`allowedTools=`、`context=`）。
- [x] `T11` 为 `run:v3:*` 日志引入 ANSI 彩色分级输出：支持不同类型日志使用不同颜色，并提供可开关控制（CLI 与环境变量）。
- [x] `T12` 修复“预言家首夜查验结果可能未进入私有上下文”的致命逻辑：查验结论必须写入预言家私有状态，并在后续 Agent 请求 Prompt 中可读取。
- [x] `T13` 修复 `RoleComponent.renderPrompt` 的空值编译回归：`seerState` 判空后再读取字段，恢复 `build:v3` 与测试可执行。
- [x] `T14` 将 LLM 相关提示词全面中文化（工具名与工具参数名保持英文）：包括 `LlmActionProvider` 的 system/user prompt、私有情报字段文案，以及 `PromptAssembler` 的分区标题，避免中英混杂造成模型理解偏差。
- [x] `T15` 为 `run_llm_game` 增加“LLM 对话/思考/工具调用可观测”参数：运行时可选打印每次请求的 system/user prompt、模型原始回复（含 `<think>`）和最终工具调用（含参数）。
- [x] `T16` 修复 LLM 行为语义冲突：`actionWindow=none` 在提示词中易被模型误解为“不能行动”；并且“必须行动回合返回 none”需要被识别并按规则降级处理，避免无效动作污染流程。
- [x] `T17` 修复“发言上下文断裂”：后位玩家与投票阶段必须能看到当日已发生的公开发言与关键公开事件（如查杀口误、对跳），避免出现“明显聊爆但无人感知”。
- [x] `T18` 修复“预言家查验信息泄漏”：`seer_checked` 只能作为预言家私有情报使用，禁止进入公共播报、公共 feed、非预言家 Prompt。
- [x] `T19` 重构广播系统为“全量事件 + 可见性过滤”：每条实时事件必须显式声明 `public | wolves_only | private_targets`，并由服务端按 `playerId + role` 过滤投递。
- [x] `T20` 重构 Agent 执行链路为“独立消息列表 + SDK tool calling”：每个 `playerId` 维护独立 chat messages，广播事件按可见性直接写入该玩家消息流；行动主路径改为 OpenAI SDK 工具调用循环（由模型自行组织直到结束回合）。
- [x] `T21` 重组运行日志并新增 `--print-thinking`：将 SDK 回合中的 `assistant` 文本与 `tool_call/tool_result` 作为“思考轨迹”输出（独立于 `--print-llm-io`），用于快速排查模型决策链路。
- [x] `T22` 增加 `--print-private-events`（默认开启）：控制台旁观日志默认输出私有事件细节（如 `seer_checked`），不影响 Agent 视角隔离与可见性过滤。
- [x] `T23` 狼队内部交流改为两轮：夜间 `speak_to_wolves` 固定执行两轮，复用同一随机顺序，随后再进入狼刀投票。
- [x] `T24` 修复前端类型检查链路回归：`npx vue-tsc --noEmit` 在当前 Node 版本（v25）崩溃，需提供可执行且稳定的前端类型验收命令（优先通过 `tsc` + 构建兜底）并更新对应文档验收口径。
- [x] `T25` 修复依赖方向阻断回归：`backend/src/v3/llm_action_provider.ts` 禁止直连 `infra/llm/openai_client`，需调整为符合 `lint:deps` 的分层依赖入口。
- [x] `T26` 将可并行决策场景改为并行 Agent 调度：`voting_pipeline.ts` 的投票请求并行发起；`day_pipeline.ts` 与 `voting_pipeline.ts` 的狼人自爆窗口请求并行发起（并保持结果决议确定性）。
- [x] `T27` 扩展狼队夜聊控制：新增 `end_wolf_chat(reason)` 行动；夜聊从固定两轮改为“最多三轮”；已结束夜聊的狼人后续轮次直接跳过，并将结束事件仅广播给狼阵营。
- [x] `T28` 重构狼队夜聊工具协议：移除 `end_wolf_chat` 独立行动，将夜聊统一为 `speak_to_wolves(text, end_chat)`；当 `end_chat=true` 时表示“发言后结束本人后续夜聊轮次”，结束说明直接复用本次发言文本并继续写入狼队可见事件流。
- [x] `T29` 扩展狼刀投票协议：将 `kill_vote` 扩展为 `kill_vote(target_id, abstain)`，允许狼人明确“弃刀”；`abstain=true` 时不计入刀人票，全部弃刀则当夜无狼刀目标。
- [x] `T30` 开局洗牌与上帝私有广播：初始化时随机洗牌角色分配；写入 `god_private_game_info` 事件（仅上帝可见，玩家不可见），包含 seat->role/camp 映射等完整开局信息。
- [x] `T31` 扩展守卫与放逐投票协议：保持“必须使用工具行动”前提下，新增 `guard(target_id, abstain)` 的空守能力与 `vote(target_id, abstain)` 的弃票能力；`abstain=true` 时不落目标，不计入对应结算。
- [x] `T32` 升级 OpenAI SDK 工具调用层描述协议：参考 `backend/src/gateway/schemas/*` 的约束表达方式，在 `LlmActionProvider` 传入 SDK 的每个工具定义中补全“工具说明 + 参数说明（description）+ 参数必填约束”，避免模型因参数语义缺失导致无效调用。
- [x] `T33` 新增 session 复盘记录管理：对局结束后按 `record/<session_id>/` 落盘 JSON 复盘文件，拆分保存 `manifest/public_timeline/logic_ops/player_views`，并保证写盘异常不影响主对局流程（详见 `docs/specs/session_replay_recording_v3.md`）。
- [x] `T29` 扩展狼刀投票协议：将 `kill_vote` 从仅提交 `target_id` 扩展为 `kill_vote(target_id, abstain)`；允许狼人明确弃刀（`abstain=true`），并在夜间结算中正确处理“全员弃刀 => 本夜无狼刀目标”。

## 3. 验收标准（任务映射）

- [x] `A01`（对应: `T01`） `backend/tests/v3/day_interrupt_hooks.test.ts` 覆盖四类窗口并通过。
- [x] `A02`（对应: `T02`） `backend/tests/v3/night_wolf_tactical_loop.test.ts` 覆盖狼队战术环并通过。
- [x] `A03`（对应: `T03`） `backend/tests/v3/sheriff_pipeline.test.ts` 覆盖竞选与票权流程并通过。
- [x] `A04`（对应: `T04`） 构建通过且 `domain/components/*` 文档与代码一致。
- [x] `A05`（对应: `T05`） 执行 `cd backend && RUN_LIVE_LLM_TEST=1 npm test -- --runInBand tests/v3/minimax_live_connectivity.test.ts` 可通过；测试日志明确打印“配置来源为根目录 `.env` 的 OPENAI_*（Minimax）”且不输出密钥明文。
- [x] `A06`（对应: `T06`） 执行 `cd backend && npm run run:v3:six` 与 `cd backend && npm run run:v3:twelve` 可分别完整跑完一局并打印最终 `snapshot` 与关键事件；执行 `cd backend && npm run run:v3` 可按六人→十二人顺序执行；`cd backend && npm run smoke:v3` 仍可走 mock 快速回归。
- [x] `A07`（流程完整性强制项） 真实 LLM 对局日志必须确认“游戏流程完整无误”：至少出现一次完整阶段链路 `night -> day -> voting`，并在结束时输出 `game_over + winner + reason`；若日志仅出现连续 `request_error/request_timeout` 且无有效流程推进证据，判定为不通过，必须继续调试后重验收。
- [x] `A08`（对应: `T07`） 执行 `cd backend && npm run run:v3:six`，日志中不再出现 `request_parse_failed`/`request_non_json_output`，非结构化输出应记录为 `request_recovered ... reason=non_json_output`，且最终仍需满足 `A07` 的完整流程要求。
- [x] `A09`（对应: `T08`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts` 通过，且用例“disallowed tool”必须回归为 fallback 行为（不被恢复解析劫持）。
- [x] `A10`（对应: `T09`） 执行 `cd backend && npm run build:v3` 通过，无 `RunLlmGameOptions` 参数缺失错误。
- [x] `A11`（对应: `T10`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts` 通过（包含发言污染过滤用例）；修复后玩家发言不再出现提示词元信息泄漏。
- [x] `A12`（对应: `T11`） 执行 `cd backend && node --import tsx src/scripts/run_llm_game.ts --board six_player_mvp --trace false --max-runtime-ms 2000 --llm-timeout-ms 500 --stream-events false --color true`，输出包含 ANSI 转义码（如 `\u001b[36m`/`\u001b[32m`），并可通过 `--color false` 或 `NO_COLOR=1` 关闭彩色。
- [x] `A13`（对应: `T12`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts tests/v3/night_wolf_tactical_loop.test.ts`，新增用例验证：预言家私有查验结果可注入后续 Prompt（`seerPrivateIntel=...`）且夜间查验结果确实写入 `seerState`。
- [x] `A14`（对应: `T13`） 执行 `cd backend && npm run build:v3` 与 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts` 均通过，不再出现 `Object is possibly 'undefined'`。
- [x] `A15`（对应: `T14`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts tests/v3/memory_compression.test.ts` 与 `cd backend && npm run build:v3` 均通过；提示词关键文本改为中文（工具名如 `check_identity`、`vote` 保持英文）。
- [x] `A16`（对应: `T15`） 执行 `cd backend && npm run run:v3:six -- --print-llm-io true`，日志中可看到：1) 每轮 LLM 的 system/user prompt；2) 模型原始回复（含 `<think>`）；3) 结构化工具调用结果（工具名+参数）；并且 `cd backend && npm run build:v3` 通过。
- [x] `A17`（对应: `T16`） 执行：1) `cd backend && npm run run:v3:six -- --max-runtime-ms 45000 --print-llm-io true`，日志确认提示词明确区分“标准轮次（actionWindow=standard_round）”与“必须行动（mustAct=true）”；2) `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts`，新增用例覆盖 SDK `finish_turn` + `mustAct=true` 时自动降级 fallback（`model_declined_required_action` 路径）；3) `cd backend && npm run build:v3` 通过。
- [x] `A18`（对应: `T17`） 执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 60000 --print-llm-io true`，在后位玩家的 `prompt_user` 中可见“当日公开发言摘要/关键事件”（例如 `player=3 phase=day` 可见 `[发言][公开][1]` 与 `[发言][公开][2]`）；并通过 `cd backend && npm run build:v3` 与 `cd backend && npm test -- --runInBand tests/v3/day_interrupt_hooks.test.ts tests/v3/llm_action_provider.test.ts tests/v3/agent_broadcast_feed.test.ts`。
- [x] `A19`（对应: `T18`） 执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 90000 --print-all-events true --print-chat true --print-llm-io true`，验证非预言家 `prompt_user` 中不再出现 `[查验记录]` 且 `公开信息摘要` 未含查验结果；实时日志不再播报“预言家已完成查验/查验结果”；并通过 `cd backend && npm run build:v3` 与 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts`。
- [x] `A20`（对应: `T19`） 执行 `cd backend && npm test -- --runInBand tests/v3/session_manager.test.ts tests/v3/broadcaster_visibility.test.ts`，验证：1) `wolves_only` 仅狼人收到；2) `private_targets` 仅目标玩家收到；3) `public` 全员可见；并通过 `cd backend && npm run build:v3`。
- [x] `A21`（对应: `T20`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts tests/v3/agent_broadcast_feed.test.ts`，验证：1) 广播信息进入对应玩家历史消息；2) 回合行动走 SDK tool calling 主路径；3) 投票阶段对外仅广播放逐结果（狼刀投票仍在狼阵营串行可见）；并通过 `cd backend && npm run build:v3` 和 `cd backend && npm run run:v3:six -- --max-runtime-ms 60000 --print-llm-io true`。
- [x] `A22`（对应: `T21`） 执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 20000 --print-thinking true`，日志出现 `[THINKING] assistant ...` 与 `[THINKING] tool_call/tool_result ...`；并通过 `cd backend && npm run build:v3` 与 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts`。
- [x] `A23`（对应: `T22`） 执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 60000`，默认日志出现私有事件明细（如 `[live][私有][查验] ...`）；执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 60000 --print-private-events false` 时该类日志不输出；并通过 `cd backend && npm run build:v3`。
- [x] `A24`（对应: `T23`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts`，验证同夜狼人发言顺序出现两轮且两轮顺序均与狼刀投票顺序一致；并通过 `cd backend && npm run build:v3`。
- [x] `A25`（对应: `T24`） 复现命令 `cd frontend && npx vue-tsc --noEmit` 记录失败；修复后执行 `cd frontend && npm run build` 通过，且 `! rg -n "\\bany\\b" frontend/src/composables/useWebSocket.ts frontend/src/composables/useGameStore.ts frontend/src/types/index.ts` 成立，并在 `docs/guides/drivers/readme.md` 的前端验收项中落地新的可执行命令。
- [x] `A26`（对应: `T25`） 复现命令 `cd backend && npm run lint:deps` 能报出违规 import；修复后同命令通过，且 `cd backend && npm run build:v3` 与 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts` 通过。
- [x] `A27`（对应: `T26`） 执行 `cd backend && npm test -- --runInBand tests/v3/parallel_agent_dispatch.test.ts tests/v3/day_interrupt_hooks.test.ts tests/v3/phase_manager_mvp.test.ts` 通过，且新增用例可证明：1) 投票请求并行发起；2) 狼人自爆窗口请求并行发起；并通过 `cd backend && npm run build:v3`。
- [x] `A28`（对应: `T27`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts tests/v3/llm_action_provider.test.ts`，验证：1) 狼聊最多三轮；2) 狼人调用 `end_wolf_chat` 后后续轮次被跳过；3) 结束事件写入狼队可见事件流；并通过 `cd backend && npm run build:v3`。
- [x] `A29`（对应: `T28`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts tests/v3/llm_action_provider.test.ts`，验证：1) 狼聊工具仅 `speak_to_wolves(text,end_chat)`；2) `end_chat=true` 后续轮次被跳过；3) 结束事件仍写入狼队可见事件流；并通过 `cd backend && npm run build:v3`。
- [x] `A30`（对应: `T29`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts tests/v3/llm_action_provider.test.ts tests/v3/phase_manager_mvp.test.ts`，验证：1) `kill_vote` 支持 `abstain=true`；2) 全部弃刀时 `wolfTarget=null` 且当夜不产生狼刀死亡；3) 广播中可区分“投刀”与“弃刀”；并通过 `cd backend && npm run build:v3`。
- [x] `A31`（对应: `T30`） 执行 `cd backend && npm test -- --runInBand tests/v3/phase_manager_mvp.test.ts tests/v3/agent_broadcast_feed.test.ts`，验证：1) 初始事件包含 `god_private_game_info` 且含 seat/role/camp；2) 玩家广播 feed 不含该事件；并通过 `cd backend && npm run build:v3`。
- [x] `A32`（对应: `T31`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts tests/v3/phase_manager_mvp.test.ts tests/v3/llm_action_provider.test.ts`，验证：1) `guard` 支持空守（`abstain=true`）；2) `vote` 支持弃票（`abstain=true`）；3) 空守/弃票不影响结算稳定性；并通过 `cd backend && npm run build:v3`。
- [x] `A33`（对应: `T32`） 执行 `cd backend && npm test -- --runInBand tests/v3/llm_action_provider.test.ts`，验证：1) SDK `tools` 中每个启用工具都带有完整 `description`；2) 参数字段具备逐项 `description` 与 `required`；3) `mustAct=false` 下附加工具 `finish_turn` 也带描述并可被模型正确识别；并通过 `cd backend && npm run build:v3`。
- [x] `A34`（对应: `T33`） 执行 `cd backend && npm run run:v3:six -- --max-runtime-ms 20000 --print-all-events true --print-chat true --print-thinking true --stream-events false`，验证：1) 生成 `record/<session_id>/manifest.json`、`public_timeline.json`、`logic_ops.json` 与 `players/player_<id>.json`；2) 玩家视角文件包含 thinking 与 tool_calls；3) 记录文件均为合法 JSON；并通过 `cd backend && npm run build:v3`、`cd backend && npm test -- --runInBand tests/v3/session_recording.test.ts tests/v3/llm_action_provider.test.ts`。
- [x] `A30`（对应: `T29`） 执行 `cd backend && npm test -- --runInBand tests/v3/night_wolf_tactical_loop.test.ts tests/v3/llm_action_provider.test.ts tests/v3/phase_manager_mvp.test.ts`，验证：1) `kill_vote` 支持 `abstain`；2) 全员弃刀时 `wolfTarget=null` 且夜间无狼刀死亡；3) 狼队投票广播可区分“投刀”与“弃刀”；并通过 `cd backend && npm run build:v3`。
