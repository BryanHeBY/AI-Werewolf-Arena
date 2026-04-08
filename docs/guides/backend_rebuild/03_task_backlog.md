# backend task backlog

## 1. 当前代码详细文档

本文是 V3 后端重构执行看板，采用“模块任务 + 验收任务”方式管理。

任务分组 A：目录与基础设施

- [x] A1 新建 V3 目录骨架（app/domain/engine/gateway/memory/infra/scenarios）。
- [x] A2 新建统一导出入口 `backend/src/index.ts`。
- [x] A3 新建依赖方向约束说明（禁止跨层反向依赖）。

任务分组 B：ECS 与系统

- [x] B1 `RoleComponent` / `CampComponent` / `AliveComponent` / `VotingRightComponent`。
- [x] B2 `StatusMarks`：`GuardMark` / `WolfKillMark` / `HealMark` / `PoisonMark`。
- [x] B3 `DamageResolutionSystem`：同守同救规则、毒药致死规则。
- [x] B4 `WinConditionSystem`：屠城/屠边判定。

任务分组 C：Phase 与事件拦截

- [x] C1 `PhaseManager`：`start_night()`、`start_day()`、`start_voting()`。
- [x] C2 夜间流水线：狼人交流 -> 守卫 -> 狼刀 -> 女巫 -> 预言家。
- [x] C3 `EventRegistry`：白痴被放逐免死 + 剥离投票权。
- [x] C4 `EventRegistry`：猎人吃毒闷枪/合法死亡触发 `shoot(target_id)`。
- [x] C5 自爆中断：`self_destruct(reason)` 触发 `jump_to("night")`。

任务分组 D：Tool Gateway 与 Prompt

- [x] D1 Tool schema 注册：`guard`、`check_identity`、`use_potion`、`shoot`、`self_destruct`。
- [x] D2 网关鉴权：同守限制、女巫自救拦截、同夜双药拦截。
- [x] D3 Prompt 组装：system facts + notebook + summary + active context。
- [x] D4 输入清洗：拦截伪造系统前缀（上帝/法官等）。

任务分组 E：场景与联调

- [x] E1 6 人局基准场景配置与回放脚本。
- [x] E2 12 人局基准场景配置与回放脚本。
- [x] E3 socket/broadcast 协议对齐与前端联调。
- [x] E4 服务入口切换到 V3（`server/index.ts`）。
- [x] E5 清理 V2 目录与旧测试，完成单栈运行。

建议执行序列：

1. A -> B -> C -> D -> E。
2. B 与 C 可部分并行，但 `DamageResolutionSystem` 先于复杂事件拦截。
3. E 仅在 C/D 出口通过后进入。

当前阻塞（2026-04-08）：

1. 无 P0-P4 阶段阻塞，当前阻塞转为“白皮书全角色覆盖”与“高级机制扩展”。

## 2. 未来目标 TODO

- [ ] 为每个任务补“责任文件路径”与“预计提交 PR 数”。
- [ ] 为每个任务补“阻塞项”和“可并行项”标签。
- [ ] 为每个任务补“回归用例编号”。

## 3. 验收标准

- [ ] 任务项覆盖 MVP 文档全部必选机制，不缺关键路径。
- [ ] 每个任务完成后都能关联到具体代码与测试结果。
- [ ] 看板状态可实时反映当前重构进度与阻塞点。
