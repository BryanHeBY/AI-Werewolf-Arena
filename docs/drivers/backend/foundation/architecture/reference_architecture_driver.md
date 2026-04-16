# Reference Architecture 开发驱动

来源参考：`docs/handbook/backend/architecture_reference.md`

## 任务
- [x] `RA01` 落地 `phase_manager` 串行时序与 hooks 调度。
- [x] `RA02` 完成 domain 组件/系统拆分归位。
- [ ] `RA03` 前端移除旧 mock，接入真实事件流。

## 验收
- [x] `RB01` phase manager 相关测试通过。
- [x] `RB02` gateway/phase 回归通过且目录归位完成。
- [ ] `RB03` 前端默认链路使用真实后端事件。

## 验收证据
1. `phase_manager`：`backend/src/game/engine/phase_manager.ts`
2. domain 组件/系统：`backend/src/core/domain/components/*`、`backend/src/core/domain/systems/*`
3. 现存阻塞：`frontend/src/composables/mockGame.ts` 与 `useGameStore.ts` 仍保留 mock 链路（`RA03`/`RB03` 不能勾选）
4. 回归命令：
   - `cd backend && npx jest tests/v3/phase_manager_mvp.test.ts --runInBand`
   - `cd backend && npx jest tests/v3/tool_gateway_validation.test.ts --runInBand`
