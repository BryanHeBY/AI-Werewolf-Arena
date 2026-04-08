# backend/src/ecs/components/MechanicalWolf.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/ecs/components/MechanicalWolf.ts`
- 当前行数：`326`
- 文件职责：机械狼示例组件与示例系统。
- 对外暴露符号（来自当前代码扫描）：
- `22:export interface MechanicalWolfIdentity extends IdentityComponent {`
- `30:export interface MechanicalWolfStatus extends StatusComponent {`
- `39:export interface MechanicalWolfSkills extends SkillComponent {`
- `46:export function createMechanicalWolfIdentity(`
- `65:export function createMechanicalWolfStatus(`
- `137:export function createMechanicalWolfSkills(`
- `154:export interface MechanicalWolfComponents {`
- `163:export function createMechanicalWolf(`
- `180:export class MechanicalWolfSystem {`
- 内容简介：
  - 当前文件已被纳入 docs/codebase 镜像体系。
  - 详细调用链可在父级 README 与 `docs/references/architecture.md`、`docs/references/api.md` 联动查看。

## 2. 未来目标 TODO

- [ ] 补充“输入/输出契约”到函数级（参数、返回、副作用）。
- [ ] 标记该文件在调用图中的上游/下游依赖。
- [ ] 为该文件补齐“测试覆盖状态”（单测/集成/E2E）。

## 3. 验收标准

- [ ] 该文档中的导出符号与源码保持一致。
- [ ] 文件职责描述可指导下一位开发者直接改动代码。
- [ ] 当源码新增或删除 export 时，本文件同步更新。
