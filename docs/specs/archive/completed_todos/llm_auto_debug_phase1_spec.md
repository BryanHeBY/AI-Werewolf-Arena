# LLM 自动调试能力（第一阶段）设计与验收文档

## 1. 背景与目标

当前对局排障主要依赖人工复盘日志，成本高、定位慢。  
本方案在不改变主对局流程稳定性的前提下，先上线第一阶段能力：

1. 为每次行动提供可选工具 `report_bug`，允许玩家 agent 主动上报疑似逻辑问题。
2. 在 session 记录中持久化这些上报，便于复盘检索与后续自动化修复。
3. 对局结束时生成调试汇总 Markdown，沉淀问题清单与 TODO。

## 2. 范围（Phase 1）

### 2.1 本期包含

1. 新增可选工具：`report_bug`（所有行动窗口可用，非 must-act 工具）。
2. 新增 `report_bug` 参数规范与校验规则。
3. `report_bug` 执行事件写入：
   - 主事件流（逻辑事件）
   - session records（结构化 JSON）
4. 对局结束时在当前 session 目录生成调试汇总文档（Markdown）。

### 2.2 本期不包含

1. 实时并发“上帝调试 agent”。
2. 调试 agent 的占位输出/回填机制。
3. 调试 agent 的连续多轮补全与增量游标分析。

> 以上作为第二阶段未来方向。

## 3. 设计原则

1. 主流程优先：`report_bug` 失败不影响主行动工具执行。
2. 低侵入：不改变既有胜负判定与阶段推进逻辑。
3. 结构化：上报内容必须可机读、可聚合、可追踪到事件证据。
4. 可扩展：字段与存储结构为第二阶段调试 agent 预留接口。

## 4. report_bug 工具设计

## 4.1 工具定位

- 类型：可选辅助工具
- 行为：仅上报，不改变游戏世界状态
- 可见性：上报内容默认不向其他玩家广播，仅用于记录与复盘

## 4.2 入参建议（第一阶段）

```json
{
  "category": "flow|rule|state|logging|other",
  "severity": "low|medium|high|critical",
  "message": "string",
  "evidence_event_seq": [1, 2, 3]
}
```

字段要求：

1. `category`：问题类型枚举。
2. `severity`：严重等级枚举。
3. `message`：简要问题描述（长度限制建议 1~300）。
4. `evidence_event_seq`：可选，引用事件序号数组（长度建议 <= 20）。

## 4.3 执行结果

工具执行成功后，返回：

```json
{
  "accepted": true,
  "report_id": "rb-<session>-<index>"
}
```

## 5. 存储与产物

## 5.1 session 结构新增建议

在 `backend/data/records/<session_id>/` 下新增：

1. `debug_reports.json`
2. `debug_summary.md`（对局结束写入）

## 5.2 debug_reports.json（建议结构）

```json
{
  "session_id": "session_xxx",
  "generated_at": "2026-04-11T00:00:00.000Z",
  "reports": [
    {
      "report_id": "rb-session_xxx-1",
      "timestamp": 1770000000000,
      "day": 2,
      "phase": "day",
      "stage": "day_speech",
      "actor_id": 7,
      "actor_role": "villager",
      "category": "flow",
      "severity": "high",
      "message": "2号已出局但仍在发言顺序中",
      "evidence_event_seq": [158, 159],
      "status": "open"
    }
  ]
}
```

## 5.3 debug_summary.md（建议结构）

建议固定章节：

1. 对局基础信息（session_id、board、winner、结束时间）
2. 问题总览（按 severity 聚合计数）
3. 问题明细（按时间顺序）
4. 建议 TODO（按优先级）

## 6. 引擎接入点（实现指引）

1. 工具注册层：
   - 加入 `report_bug` schema（描述 + 参数说明）。
2. LLM 工具调用层：
   - 支持该工具调用与参数校验。
3. 记录层：
   - 收集并落盘 `report_bug` 事件。
4. session 结束钩子：
   - 汇总 `report_bug` 数据并生成 `debug_summary.md`。

## 7. 验收标准（Phase 1）

满足以下即验收通过：

1. 玩家可在任意行动窗口调用 `report_bug` 且不影响主流程推进。
2. 错误参数会被拒绝并记录失败原因（不崩局）。
3. 每条有效上报可在 `debug_reports.json` 中找到。
4. 对局结束后自动生成 `debug_summary.md`，且包含 TODO 列表。
5. 重跑同类局时，能从 `debug_summary.md` 快速定位高优先级问题。

## 8. 风险与防护

1. 误报噪声高：
   - 通过 `severity` 与 `category` 聚合降噪。
2. 恶意或注入文本：
   - `message` 长度限制 + 基础敏感格式过滤。
3. records 膨胀：
   - 限制单局上报条数（建议上限 200）。

## 9. TODO（第一阶段实施清单）

- [x] 新增 `report_bug` 工具 schema 与参数校验
- [x] 将 `report_bug` 挂载到所有行动窗口的可选工具集合
- [x] 新增 `report_bug` 逻辑事件定义与记录
- [x] 新增 `debug_reports.json` 落盘能力
- [x] 新增 `debug_summary.md` 生成器
- [x] 补充单测：参数校验、落盘、汇总文档生成
- [x] 补充端到端回归：包含至少 1 条 report_bug 的完整对局

## 10. 第二阶段未来方向（Future）

第二阶段目标：接入上帝视角并发调试 agent（不阻塞主流程）。

候选能力：

1. 调试 agent 实时消费增量事件流并并发分析。
2. 支持“占位输出 + 异步回填”调试日志块。
3. 将玩家 `report_bug` 作为高优先级输入，触发重点校验。
4. 局末输出增强版调试报告：
   - Confirmed / Suspected 分级
   - 可执行修复建议
   - 自动生成代码级 TODO 线索（文件/模块定位）

推进前置条件：

1. 先验证第一阶段上报质量与噪声水平。
2. 明确调试 agent 的 token 配额与限流策略。
3. 建立并发写入与顺序一致性规则（基于 seq/request_id）。
