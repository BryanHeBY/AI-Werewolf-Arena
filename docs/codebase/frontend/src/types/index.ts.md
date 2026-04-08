# frontend/src/types/index.ts

## 1. 当前代码详细文档

- 源码路径：`frontend/src/types/index.ts`
- 当前行数：`234`
- 文件职责：前端本地类型定义。
- 对外暴露符号（来自当前代码扫描）：
- `5:export enum GamePhase {`
- `21:export enum Faction {`
- `29:export enum RoleType {`
- `39:export enum ActionType {`
- `52:export interface AgentOutput {`
- `64:export interface PlayerAction {`
- `77:export interface Player {`
- `89:export interface PublicPlayer {`
- `100:export interface PublicGameState {`
- `119:export interface ModelConfig {`
- `130:export interface GameConfig {`
- `142:export interface NightResult {`
- `152:export interface CheckResult {`
- `160:export enum BroadcastEventType {`
- `178:export interface BroadcastEvent {`
- `188:export interface GameState {`
- `208:export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;`
- `213:export interface OODACycle {`
- `223:export type EnvironmentInterface = Environment;`
- `228:export interface Role extends OODACycle {`
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
