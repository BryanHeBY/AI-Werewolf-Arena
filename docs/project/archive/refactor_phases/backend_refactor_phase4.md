# Backend 目录重构（第四阶段）

## 目标
- 将核心领域模型物理聚合到 `core/domain`，建立清晰依赖方向。

## 本阶段范围
1. 物理迁移
   - `src/domain -> src/core/domain`
2. 调整引用关系，确保依赖方向：
   - `core` 不依赖 `game/ai/runtime/server`
   - `game` 仅依赖 `core`
3. 增加简单静态检查（lint 规则或约定文档）

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run test:quick`
- 架构文档中的依赖方向与代码一致
