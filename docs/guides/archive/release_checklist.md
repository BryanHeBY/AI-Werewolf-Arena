# release checklist

## 1. 当前代码详细文档

本清单用于每次 V3 发布前的统一自检，覆盖条款、代码、测试、回滚四个维度。

执行命令：

1. `cd backend && npm run build:v3`
2. `cd backend && npm run test:quick`
3. `cd backend && npm run test:full`
4. `cd backend && npm run smoke:v3`
5. `cd backend && npm run lint:deps`
6. `cd backend && npm run release:check`

## 2. 发布前检查项

- [x] `C01` 白皮书与 MVP 条款映射已更新（`docs/specs/*.md` 与 `docs/guides/*.md` 一致）。
- [x] `C02` 变更文件列表已确认，且仅包含本次范围内模块。
- [x] `C03` 关键回归测试通过（中断窗口、狼人战术环、警长链路、记忆压缩）。
- [x] `C04` 真实模型连通测试通过（`RUN_LIVE_LLM_TEST=1`）。
- [x] `C05` 切换回滚链路验证通过（`cutover_rollback.test.ts`）。
- [x] `C06` 依赖方向检查通过（`npm run lint:deps`）。

## 3. 验收标准

- [x] `A01` 发布检查记录包含每条命令的通过/失败结论与时间戳。
- [x] `A02` 任一检查失败时，必须阻断发布并回写 `docs/guides/backend_rebuild/03_task_backlog.md`。
- [x] `A03` 发布完成后必须附带 `docs/guides/release_report_template.md` 的实例记录。
