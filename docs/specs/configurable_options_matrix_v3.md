# V3 可选配置清单（扫描版）

## 目的
本清单用于汇总当前后端已存在的可配置项，以及仍为硬编码、建议抽象为配置项的机制。

## 你提出的5项
1. 板子配置：已支持（`BoardConfig` / 场景文件）。
2. 胜利条件：已支持（`winConditions[]` + `WinConditionRegistry`）。
3. 是否允许自爆：已支持（`selfDestruct.enabledWindows`）。
4. 是否允许女巫首夜自救：目前是角色初始化硬编码（默认不允许），建议升级为板子配置。
5. 平票处理机制：目前硬编码为“票数相同取最小编号/最小座位”，建议升级为配置策略。

---

## 一、当前已支持的核心配置（代码可配）

### 1) 板子层配置（`BoardConfig`）
- 位置：
  - `backend/src/domain/model.ts`
  - `backend/src/scenarios/six_player_mvp.ts`
  - `backend/src/scenarios/twelve_player_standard.ts`
- 可配置项：
  - `boardSize`：玩家数量
  - `roleSetups`：角色构成（每种角色数量）
  - `revealOnDeath`：死亡是否翻牌
  - `enableSheriff`：是否启用警长系统
  - `initialSheriffSeat`：初始警长座位（可选）
  - `winConditions`：胜利条件数组（按顺序评估）
  - `winCondition`：旧版兼容单值字段（建议迁移）
  - `hooks`：
    - `onDaybreak`
    - `onPreElection`
    - `onPreVote`
    - `onPerSpeechGap`
  - `selfDestruct.enabledWindows`：允许自爆的窗口集合

### 2) 胜利条件
- 位置：
  - `backend/src/mechanisms/win_conditions/default_specs.ts`
  - `backend/src/mechanisms/registries/win_condition_registry.ts`
- 已支持：
  - `SlaughterCity`
  - `SlaughterSide`

### 3) 警长机制相关
- 位置：`backend/src/mechanisms/sheriff/sheriff_mechanism.ts`
- 已支持规则：
  - 警长票权：`1.5`（当前为常量）
  - 警长投票仅警下可投
  - 候选、退水、投票流程

### 4) 运行与调试环境变量（运行时配置）
- 主要位置：
  - `backend/src/scripts/run_llm_game.ts`
  - `backend/src/config/index.ts`
  - `backend/src/infra/llm/openai_client.ts`
  - `backend/src/session_recording/debug_summary_generator.ts`
- 代表项：
  - OpenAI：`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_TEMPERATURE` / `OPENAI_MAX_TOKENS` / `OPENAI_FORCE_JSON`
  - V3 运行：`V3_LLM_BOARD` / `V3_LLM_MAX_DAYS` / `V3_LLM_MAX_RUNTIME_MS` / `V3_LLM_TIMEOUT_MS`
  - 输出与调试：`V3_PRINT_ALL_EVENTS` / `V3_PRINT_CHAT` / `V3_PRINT_LLM_IO` / `V3_PRINT_THINKING` / `V3_PRINT_PRIVATE_EVENTS`
  - 记录目录：`GAME_RECORDS_DIR`

---

## 二、扫描后发现的“建议升级为配置项”（当前多为硬编码）

### A. 女巫首夜自救
- 当前状态：
  - `canSelfHeal` 在 `backend/src/mechanisms/roles/witch/profile.ts` 初始化为 `false`。
  - 校验在 `backend/src/mechanisms/roles/witch/validation_rules.ts`。
- 建议：
  - 新增板子配置，例如 `witch.canSelfHealFirstNight`（或 `witch.canSelfHeal`）。
  - 初始化私有状态时按板子配置注入。

### B. 平票处理策略
- 当前状态：
  - 放逐平票：`VotingPipeline.pickMajorityTarget` 按最小编号决议。
  - 狼刀平票：`NightPipeline.pickMajorityTarget` 按最小编号决议。
  - 警长平票：`SheriffMechanism.pickSheriffWinner` 按最小座位决议。
- 建议：
  - 新增统一策略配置，例如：
    - `tieBreaker.exileVote`
    - `tieBreaker.wolfKillVote`
    - `tieBreaker.sheriffVote`
  - 可选策略：
    - `min_id`
    - `min_seat`
    - `no_elimination`
    - `revote_once`
    - `random`

### C. 警长票权倍率
- 当前状态：`SheriffMechanism.SHERIFF_VOTE_WEIGHT = 1.5`。
- 建议：
  - 新增 `sheriff.voteWeight` 板子配置。

### D. 自爆窗口默认策略
- 当前状态：
  - 未显式配置时，默认仅 `on_pre_vote` 可自爆（`DayPipeline` / `VotingPipeline` 中 `isSelfDestructWindowEnabled`）。
- 建议：
  - 保持默认值，但在文档中固定为可显式配置项，避免行为隐式。

### E. 行动重试次数
- 当前状态：
  - 投票与狼刀重试次数当前为常量 `3`（`VotingPipeline`、`wolf/night_stages.ts`）。
- 建议：
  - 新增 `llmAction.maxRetries` 或分工具配置（`vote` / `kill_vote`）。

### F. `report_bug` 限流策略
- 当前状态：
  - 由 `LlmActionProvider` 内部常量控制（按 actor/day/phase 限流与去重）。
- 建议：
  - 新增 `debug.reportBug` 配置：
    - `maxPerActorPerDay`
    - `dedupeByScope`
    - `dedupeByMessage`

### G. 目标提示策略（target hint）
- 当前状态：
  - 已抽象为 `TargetHintRegistry`（按角色与工具判断是否允许包含自己）。
- 建议：
  - 增加板子级开关，支持“严格仅合法目标”与“宽松提示目标”两种模式。

---

## 三、建议的下一步配置结构（草案）

```ts
interface ExtendedBoardConfig {
  boardSize: number;
  roleSetups: Array<{ role: Role; count: number }>;
  revealOnDeath: boolean;
  enableSheriff: boolean;
  winCondition: WinCondition;
  hooks: HookConfig;
  selfDestruct?: { enabledWindows: ActionWindow[] };

  sheriff?: {
    voteWeight?: number; // default 1.5
  };

  witch?: {
    canSelfHeal?: boolean; // default false
  };

  tieBreaker?: {
    exileVote?: "min_id" | "min_seat" | "no_elimination" | "revote_once" | "random";
    wolfKillVote?: "min_id" | "no_kill" | "random";
    sheriffVote?: "min_seat" | "revote_once" | "random";
  };

  llmAction?: {
    voteMaxRetries?: number; // default 3
    wolfKillVoteMaxRetries?: number; // default 3
  };

  debug?: {
    reportBug?: {
      maxPerActorPerDay?: number; // default 3
    };
  };
}
```

---

## 四、本次扫描覆盖范围
- `backend/src/domain`
- `backend/src/scenarios`
- `backend/src/engine`
- `backend/src/mechanisms`
- `backend/src/scripts`
- `backend/src/config`
- `backend/src/infra/llm`
- `backend/src/session_recording`
