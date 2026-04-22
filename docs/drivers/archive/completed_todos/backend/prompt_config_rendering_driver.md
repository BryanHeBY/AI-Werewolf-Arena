# Prompt Config Rendering 开发驱动

来源规范：`docs/specs/backend/evolution/ai/prompt_config_rendering_spec_v3.md`

## 任务
- [x] `PC01` 补全配置到文案映射字典。
- [x] `PC02` 增加配置渲染注册器并接入 `LlmActionProvider`。
- [x] `PC03` 在 prompt 模板追加“本局规则配置”段落。
- [x] `PC04` 补齐警长开关/胜利条件/默认规则相关测试。
- [x] `PC05` 回写相关文档链接。

## 验收
- [x] `PA01` 初始 prompt 包含胜利条件与关键机制开关。
- [x] `PA02` 警长关闭场景无上警误导文案。
- [x] `PA03` 多胜利条件按配置顺序渲染。
- [x] `PA04` 缺省配置时渲染默认规则文案。

## 验收证据
1. `backend/tests/v3/config_render_registry.test.ts`（新增）
2. 命令：`cd backend && npx jest tests/v3/config_render_registry.test.ts --runInBand`
