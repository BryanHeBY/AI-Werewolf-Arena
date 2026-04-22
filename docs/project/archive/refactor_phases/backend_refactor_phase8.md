# Backend 目录重构（第八阶段）

## 目标
- 将 LLM Provider 适配层从通用基础设施层剥离到 `ai` 域。
- 让 `infra` 仅保留通用技术设施（传输/网络等），AI 专属能力归口 `ai`。

## 本阶段范围
1. 物理迁移
   - `src/infra/llm -> src/ai/integrations/llm`
2. 导入修复
   - 更新 `runtime/observability/ai` 相关调用点
3. 验证
   - 构建与 mock 运行通过

## 暂不包含
- `transport` 与 `broadcaster` 的事件结构解耦（作为下一阶段）

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run run:v3:mock`
- `src/infra` 下不再存在 `llm` 目录
