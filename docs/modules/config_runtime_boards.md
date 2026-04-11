# Runtime Board Configs

当前目录用于存放运行时板子配置，读取路径由 `.env` 的 `GAME_CONFIGS_DIR` 指定。

已接入的配置文件（统一放在 `boards/` 下）：
- `boards/six_player_mvp.json`
- `boards/twelve_player_standard.json`
- `boards/game-config.json`（可选聚合格式，支持 `boards.<board_name>`）

推荐配置结构：

1. `board`：板子规模与角色构成（`size`、`roleSetups`）
2. `rules`：通用规则（`revealOnDeath`、`winConditions`、`hooks`）
3. `mechanisms`：机制配置（`sheriff`、`selfDestruct`、`tieBreaker`）
4. `roles`：角色定制配置（如 `roles.witch.selfHeal`）

运行时读取优先级（按顺序）：
1. `${GAME_CONFIGS_DIR}/boards/${board}.json`（当传入 `--board` 或 API 的 `board` 时）
2. `${GAME_CONFIGS_DIR}/boards/${board}.json`
3. `${GAME_CONFIGS_DIR}/boards/game-config.json`
4. 兼容兜底：`${GAME_CONFIGS_DIR}/*.json`（历史路径）

说明：
- 原 `configs/system-prompts/*.json` 已弃用且目录已移除。
