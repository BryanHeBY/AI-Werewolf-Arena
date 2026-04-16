# Session Timeline API 重构驱动

## 1. 目标

把“session 复盘数据”从文件能力升级为 API 能力，满足前端整局回放需求：

1. 整局 timeline
2. 阶段窗口查询
3. 玩家视角查询
4. 终局结果查询

## 2. 执行阶段

### Phase A：录盘结构升级

1. 在 `session_record_manager` 增加 `phase_windows` 构建
2. 对外写出 `phase_windows.json`、`timeline_index.json`
3. 保持 `manifest/public_timeline/player_x` 向后兼容

### Phase B：查询仓储层

1. 新增 `server/replay_record_repository.ts`
2. 封装读取与分页过滤（`fromSeq/toSeq/phaseId`）
3. 统一不存在时的错误语义

### Phase C：REST 路由

1. 增加 `/api/v1/sessions/:sessionId/timeline`
2. 增加 `/api/v1/sessions/:sessionId/phases`
3. 增加 `/api/v1/sessions/:sessionId/players/:playerId/timeline`
4. 对齐 `/api/v1/sessions/:sessionId/result`

### Phase D：前端联调与回归

1. 验证 6 人、12 人局返回结构一致
2. 验证包含 retry 的玩家 timeline 顺序不乱
3. 验证阶段切片与公开 timeline `seq` 对齐

## 3. 任务清单

- [x] `T01` 录盘层新增 `phase_windows.json` 与 `timeline_index.json` 输出。
- [x] `T02` 查询仓储层实现 session record 读取、过滤、分页。
- [x] `T03` 落地 3 个 timeline 相关 REST 路由。
- [x] `T04` 对齐 `result` 接口，保证复盘页一次拿齐核心数据。
- [x] `T05` 增加最小 API 集成测试（含错误场景）。

## 4. 验收标准

- [x] `A01`（对应 `T01`） 运行一局后生成 `phase_windows.json`、`timeline_index.json`。
- [x] `A02`（对应 `T02`） `fromSeq/toSeq/phaseId` 过滤结果正确且稳定。
- [x] `A03`（对应 `T03`） timeline / phases / player timeline 三类接口可用。
- [x] `A04`（对应 `T04`） result 接口可直接驱动终局展示。
- [x] `A05`（对应 `T05`） 接口集成测试通过，404/422/503 场景覆盖。

## 5. 参考文档

1. `docs/apis/session_rest_api_v1_spec.md`
2. `docs/apis/session_timeline_api_v1_spec.md`
3. `docs/specs/backend/evolution/observability/session_replay_recording_v3.md`

## 6. 验收证据

1. 录盘结构：`backend/src/observability/session_record_manager.ts` 新增 `phase_windows.json` / `timeline_index.json` 输出。
2. 查询仓储：`backend/src/server/replay_record_repository.ts` 提供 `fromSeq/toSeq/phaseId` 过滤与错误语义。
3. API 路由：`backend/src/server/index.ts` 新增 `/api/v1/sessions/:sessionId/{timeline,phases,players/:playerId/timeline,result}`。
4. API 测试：`cd backend && npx jest tests/v3/session_timeline_api.test.ts --runInBand`（通过，3/3）。
5. 编译验证：`cd backend && npm run build:v3`（通过）。
