# backend/src/core/types.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/core/types.ts`
- 当前行数：`388`
- 文件职责：后端核心类型中枢，定义阶段、动作、广播、ECS 等基础类型。
- 对外暴露符号（来自当前代码扫描）：
- `6:export enum GamePhase {`
- `30:export enum Faction {`
- `38:export enum RoleType {`
- `49:export enum ActionType {`
- `67:export interface AgentOutput {`
- `79:export interface PlayerAction {`
- `92:export interface Player {`
- `106:export interface PublicPlayer {`
- `117:export interface PublicGameState {`
- `137:export interface ModelConfig {`
- `148:export interface GameConfig {`
- `160:export interface NightResult {`
- `170:export interface CheckResult {`
- `178:export interface ChatMessage {`
- `191:export enum BroadcastEventType {`
- `210:export interface BroadcastEvent {`
- `221:export interface GameState {`
- `243:export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;`
- `248:export interface OODACycle {`
- `258:export type EnvironmentInterface = Environment;`
- `263:export interface Role extends OODACycle {`
- `279:export interface StackNode {`
- `288:export type EntityId = number;`
- `294:export interface Entity {`
- `302:export interface Component {`
- `310:export interface IdentityComponent extends Component {`
- `320:export interface StatusComponent extends Component {`
- `331:export interface Skill {`
- `343:export interface SkillComponent extends Component {`
- `351:export interface System {`
- `359:export interface World {`
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
