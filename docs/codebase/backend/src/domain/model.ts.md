# backend/src/domain/model.ts

## 1. 当前代码详细文档

- 源码路径：`backend/src/domain/model.ts`
- 文件类型：`ts`
- 当前行数：`151`
- 文件定位：V3 域模型与基础抽象文件。
- 上级目录文档：[README.md](./README.md)
- 关联规范：`docs/specs/backend_architecture_whitepaper_v3.md`、`docs/specs/v3_mvp_requirements.md`

### 代码内容简介
- 当前文件属于 V3 主线实现，是后续扩展与联调的直接基线。
- 迭代时优先比对本文件导出项、依赖项与阶段职责。

### 对外暴露类型/接口/函数
- `1:export type EntityId = number;`
- `3:export enum Camp {`
- `9:export enum Role {`
- `19:export enum Phase {`
- `26:export enum ActionWindow {`
- `33:export enum StatusMark {`
- `40:export enum WinCondition {`
- `45:export enum PotionType {`
- `51:export interface HookConfig {`
- `58:export interface BoardConfig {`
- `68:export interface PromptRenderable {`
- `72:export interface ToolArgMap {`
- `85:export type ToolName = keyof ToolArgMap;`
- `87:export type ToolCall = {`
- `91:export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;`
- `93:export interface ToolValidationResult<T extends ToolCall = ToolCall> {`
- `99:export interface ActionRequest {`
- `107:export interface ActionProvider {`
- `111:export interface GameEvent {`
- `117:export interface GameResult {`
- `122:export interface SeerCheckResult {`
- `128:export interface NightSummary {`
- `135:export interface DaySummary {`
- `140:export interface VotingSummary {`
- `146:export interface RuntimeSnapshot {`

### 关键依赖（import）
- 无显式 import（或由构建工具注入）。

## 2. 未来目标 TODO

- [ ] 扩展 ECS 组件与系统，覆盖白皮书更多角色与印记。
- [ ] 补齐函数级输入/输出/副作用说明。
- [ ] 补齐该文件的测试覆盖现状（单测/集成/E2E）。
- [ ] 源码发生 export 或 import 变更时，同步更新本文档。

## 3. 验收标准

- [ ] 本文档中的导出项与源码实际 `export` 保持一致。
- [ ] 关键依赖列表可支持重构时进行影响面分析。
- [ ] 通过本文档可定位该文件在 V3 重构中的责任边界。
