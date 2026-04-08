# backend execution phases

## 1. 当前代码详细文档

本文定义 V3 后端重构的阶段推进策略，强调“可停、可验、可回滚”。

阶段 P0：重构基线冻结（文档与现状）

1. 冻结当前 `backend/src` 作为 V2 基线。
2. 确认 `docs/codebase/backend/*` 与现状一致。
3. 明确 V3 目标目录与阶段输出物。

阶段 P1：ECS 与核心流程骨架

1. 建立 `domain/components`（Role/Camp/Alive/VotingRight/StatusMarks）。
2. 建立 `engine/phase_manager.ts` 与 day/night/voting 基础 pipeline。
3. 建立 `domain/systems` 的 `damage_resolution_system` 与 `win_condition_system`。

阶段 P2：Tool Gateway 与规则鉴权

1. 建立 tool schema（`guard`/`use_potion`/`shoot`/`self_destruct`）。
2. 建立 action validator，覆盖同守、自救限制、双药限制、非法技能。
3. 打通“错误回弹 + 重试”路径。

阶段 P3：事件拦截与 MVP 机制闭环

1. 实现 `EventRegistry`：白痴免死、猎人闷枪/开枪、自爆中断跳夜。
2. 完成 6 人局闭环。
3. 完成 12 人局关键机制闭环。

阶段 P4：联调、稳定性与切换

1. 接入 transport 与前端协议联调。
2. 增加回放日志与失败重放脚本。
3. 做一次灰度切换演练与回滚演练。

阶段出口条件：

1. P1 出口：核心流程可跑通一个最小夜晚-白天循环。
2. P2 出口：关键 Tool 都有 schema + 鉴权 + 错误回弹。
3. P3 出口：6/12 人 MVP 用例全部通过。
4. P4 出口：联调稳定，发布与回滚脚本可执行。

## 2. 未来目标 TODO

- [ ] 为每个阶段补充“预计提交数”和“最小交付粒度”。
- [ ] 为每个阶段补充“阻塞依赖”与“并行任务”。
- [ ] 为每个阶段补充“失败时回退到哪个稳定点”。

## 3. 验收标准

- [ ] 阶段边界清晰，团队可按阶段并行推进。
- [ ] 每阶段结束都可通过出口条件判断是否可继续。
- [ ] 不同阶段之间的依赖顺序清晰，无反复返工循环。
