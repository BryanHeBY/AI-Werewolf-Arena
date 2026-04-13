# Backend 目录重构（第三阶段）

## 目标
- 将“对局编排层”物理聚合到 `game/`，减少横向跳转。

## 本阶段范围
1. 物理迁移
   - `src/engine -> src/game/engine`
   - `src/mechanisms -> src/game/mechanisms`
   - `src/gateway -> src/game/gateway`
2. 全量重写内部 import 到新路径
3. 保留旧路径兼容导出（shim）1 个阶段

## 风险
- 相对路径批量替换容易漏改。
- 测试与脚本中硬编码路径可能失效。

## 回滚
- 以单提交完成迁移，可整提交回滚。

## 验收标准
- `npm -C backend run build:v3`
- `npm -C backend run test:quick`
- `npm -C backend run run:v3:mock`
