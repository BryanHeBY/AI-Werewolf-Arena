# V3遗留任务迁移到V4

## 1. 目的

将 `docs/drivers` 中仍未完成、且已明确延期到 V4 的任务集中管理，避免 V3 驱动文档持续挂载未完成项。

迁移日期：2026-04-22

---

## 2. 迁移来源

1. `docs/drivers/backend/foundation/gameplay/gameplay_whitepaper_v3_driver.md`
2. `docs/drivers/backend/foundation/architecture/reference_architecture_driver.md`

---

## 3. V4待实现任务清单

### 3.1 Gameplay（原 V3 驱动）

1. `GW01` 角色全量配置注册并可被引擎识别。
2. `GW02` 补齐关键技能结算链路（魅惑/反弹/学习/诱导/自爆/复活）。
3. `GW03` 对齐胜负判定、遗言、警徽、冲突判定实现。
4. `GW04` 增加角色规则回放回归测试。
5. `GA01` 全角色可在配置层启用并稳定运行。
6. `GA02` 关键技能与胜负判定行为与规范一致。

### 3.2 Reference Architecture（原 V3 驱动）

1. `RA03` 前端移除旧 mock，接入真实事件流。
2. `RB03` 前端默认链路使用真实后端事件。

---

## 4. 迁移规则

1. 以上条目从 V3 `docs/drivers` 中移除，不再作为 V3 交付阻塞项。
2. 后续在 V4 开发周期中落地，建议在 V4 driver 中复用原编号（`GW*`,`GA*`,`RA*`,`RB*`）以保持追踪连续性。
3. 若任务被拆分，需在 V4 文档中建立“原编号 -> 新编号”映射。
