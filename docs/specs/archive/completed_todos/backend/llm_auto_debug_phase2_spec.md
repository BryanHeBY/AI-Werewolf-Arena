# LLM 自动调试能力（第二阶段）设计与验收文档

## 1. 背景与目标

第一阶段已实现 `report_bug` 与终局 `debug_summary.md` 输出，但单次 LLM 汇总会遇到上下文超限，且缺少玩家视角细节。本阶段通过并行子 agent 分工分析，提升覆盖率与稳定性。

目标：
1. 并行子 agent 分析公开事件、逻辑事件、玩家视角与上报问题。
2. 汇总阶段对多源结果去重、排序，输出稳定的 `debug_summary.md`。
3. 支持失败降级（部分子 agent 失败不影响整体输出）。

## 2. 范围（Phase 2）

### 2.1 本期包含

1. 子 agent 并行调度：public / logic / reports / player per-id。
2. 子 agent 输出统一 JSON 结构。
3. 汇总器合并输出 `debug_summary.md`。
4. 可配置并行与超时策略。

### 2.2 本期不包含

1. 实时增量消费（仍在终局生成）。
2. 终局后自动修复或生成代码补丁。
3. 跨局聚合与趋势分析。

## 3. 设计原则

1. 主流程优先：调试 agent 全部为旁路流程，失败不影响对局结束落盘。
2. 小上下文：每个子 agent 仅处理其负责的文件或切片。
3. 可追踪：每条问题应附带证据序号或来源标识。
4. 可降级：子 agent 失败时标记，并由汇总器输出缺失项。

## 4. 子 agent 设计

### 4.1 子 agent 类型

1. `agent_public`
   - 输入：`public_timeline.json`
   - 关注：阶段顺序异常、缺失广播、遗言/放逐/警长流程缺失

2. `agent_logic`
   - 输入：`logic_ops.json`
   - 关注：动作被拒、结算冲突、校验失败、网关错误

3. `agent_reports`
   - 输入：`debug_reports.json`
   - 关注：report_bug 聚合、噪声过滤、优先级排序

4. `agent_player_<id>`（每位玩家一个）
   - 输入：`players/player_<id>.json`
   - 关注：行动提示缺失、死后仍发言、身份/范围异常、工具调用失败

### 4.2 子 agent 输出 JSON（统一结构）

```json
{
  "agent": "player_5",
  "findings": [
    {
      "severity": "high",
      "category": "flow",
      "message": "死后仍发言",
      "evidence": [121, 124],
      "source": "players/player_5.json"
    }
  ],
  "notes": ["可能与放逐结算顺序有关"],
  "missing_info": ["未读取到 last_words 事件"]
}
```

字段要求：
1. `severity`：low|medium|high|critical
2. `category`：flow|rule|state|logging|other
3. `message`：1~300 字
4. `evidence`：事件序号或时间戳数组（可为空）
5. `source`：输入文件路径

## 5. 汇总器设计

### 5.1 输入

- `agent_public.json`
- `agent_logic.json`
- `agent_reports.json`
- `agent_player_<id>.json`

### 5.2 合并逻辑

1. 合并 `findings` 列表。
2. 去重（同 `category + message + evidence` 视为重复）。
3. 按 `severity` 优先级排序，再按 `evidence` 升序。
4. 汇总 `missing_info` 与失败 agent 列表。

### 5.3 输出 `debug_summary.md` 结构

建议固定章节：
1. Session 基础信息
2. Bug Report Stats
3. Findings
4. TODO / Conclusion
5. Debug Pipeline 状态（列出失败 agent）

## 6. 接入点（实现指引）

1. 新增 `debug_summary_pipeline.ts`
2. 在 `debug_summary_generator.ts` 中调用 pipeline
3. 仍保留 fallback 渲染（当所有 agent 失败时）
4. 子 agent 输出落盘到 `debug_summary_agents/` 目录

目录结构示例：

```
backend/data/records/<session_id>/
  debug_summary.md
  debug_summary_agents/
    agent_public.json
    agent_logic.json
    agent_reports.json
    agent_player_1.json
    ...
```

## 7. 配置项

- `DEBUG_SUMMARY_AGENT_TIMEOUT_MS`（默认 15000）
- `DEBUG_SUMMARY_AGENT_MAX_ATTEMPTS`（默认 2）
- `DEBUG_SUMMARY_AGENT_CONCURRENCY`（默认 4）

## 8. 验收标准

1. 终局生成 `debug_summary_agents/*` 与 `debug_summary.md`。
2. 任意子 agent 失败时，仍可生成 `debug_summary.md`。
3. 每位玩家都有独立子 agent 输出。
4. `debug_summary.md` 中记录失败 agent 列表。
5. `tests/v3` 覆盖至少 1 次并行调度场景。
