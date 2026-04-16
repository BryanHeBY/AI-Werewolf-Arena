# Deprecated System Prompts

`configs.example/system-prompts/` 已弃用（目录已移除）。

这些 JSON 目前不会被后端读取，真实生效的系统提示词由以下模块生成：
- `backend/src/ai/agents/llm/prompt_templates.ts`
- `backend/src/game/mechanisms/roles/*`

请勿在本目录修改提示词并期待运行时生效。
