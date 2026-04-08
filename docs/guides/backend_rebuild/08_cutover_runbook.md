# cutover runbook

## 1. 当前代码详细文档

本 Runbook 用于 V3 后端发布切换执行，按分钟序列操作。

### T-10 min
1. 执行 `cd backend && npm run build`
2. 执行 `cd backend && npm test -- --runInBand`
3. 执行 `cd backend && npm run run:v3`

### T-5 min
1. 启动服务：`cd backend && npm run start`
2. 健康检查：`curl -s http://127.0.0.1:3344/api/status`
3. 开局检查：`curl -s http://127.0.0.1:3344/api/start-game`

### T-2 min
1. 订阅 WebSocket `gameEvent`，确认收到 `game_started`、`phase_changed`
2. 查询会话：`curl -s http://127.0.0.1:3344/api/session`
3. 记录本次 `gameId` 和 commit sha

### T+0 min
1. 正式放量（内部 -> 小流量 -> 全量）
2. 观察指标：错误率、平均响应延迟、异常中断率
3. 若触发高风险阈值，立即执行回滚模板

## 2. 未来目标 TODO

- [x] 增加自动化发布脚本（串联 build/test/smoke/check）。
- [x] 增加可视化观测面板链接与阈值规则。
- [x] 增加发布通知模板（含风险与回滚口令）。

## 3. 验收标准

- [x] 任何成员可按本 Runbook 独立完成一次切换。
- [x] 每一步都有明确命令与验证输出。
- [x] 切换失败时可无歧义转入回滚流程。
