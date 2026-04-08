# backend/src/core/types.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/core/types.ts`
- 文件类型：`ts`
- 当前行数：`388`
- 文件定位：后端核心流程文件，参与游戏状态推进或关键结算。
- 上级目录文档：[README.md](./README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 代码内容简介
- 当前文件参与 V2 现状实现，并将作为 V3 重构映射依据。
- 重构时优先比对本文件导出项、依赖项与阶段职责。

### 对外暴露类型/接口/函数
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

### 关键依赖（import）
- `./Environment`

## 2. 未来目标 TODO

- [ ] 按 V3 白皮书重构为严格串行 PhaseManager + Hooks。
- [ ] 补齐函数级输入/输出/副作用说明。
- [ ] 补齐该文件的测试覆盖现状（单测/集成/E2E）。
- [ ] 源码发生 export 或 import 变更时，同步更新本文档。

## 3. 验收标准

- [ ] 本文档中的导出项与源码实际 `export` 保持一致。
- [ ] 关键依赖列表可支持重构时进行影响面分析。
- [ ] 通过本文档可定位该文件在 V3 重构中的责任边界。
