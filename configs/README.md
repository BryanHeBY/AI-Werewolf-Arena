# Deprecated Configs

该目录已弃用，当前后端运行链路不会读取这里的配置文件。

当前状态：
- `configs/game-config.json`：未接入运行时；
- `configs/system-prompts/*.json`：未被 `backend/src` 读取。

现行配置来源：
- 运行参数与环境变量：`.env` + `backend/src/scripts/run_llm_game.ts`
- 机制与 Prompt：`backend/src/mechanisms/*`、`backend/src/agents/llm/prompt_templates.ts`

后续处理建议：
1. 先保留目录用于迁移观察期（当前阶段）。
2. 确认无引用后可直接删除本目录及 README 文档中的历史描述。
