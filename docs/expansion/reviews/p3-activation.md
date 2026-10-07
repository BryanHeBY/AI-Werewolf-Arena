# P3 最终激活交叉审查

日期：2026-10-08。P3在I01–I04与诊断/CLI分批基础上完成现有七角色双语路径；ACP可选空行动以独立commit e498014修正，英文激活是另一笔提交。

## 验收与范围证据

| P3要求 | 当前证据 |
| --- | --- |
| 共用文本/术语与逐局语言 | game-text/game-catalog与I01 key/参数/缺译、不变性测试；World只读locale、调用方display独立；64名称不等于角色激活 |
| 提示/工具/拒绝 | I02真实SDK/MCP两语schema/描述、七角色十四阶段、共享约束/retry和错误解释；最终ASCII全prompt实际wire检查 |
| 运行/CLI/人格 | runtime-display审查：真实多CLI安全JSON与局部语言、结构warn、双语12席示例，用户原文不译 |
| 审计 | I02实际SDK/ACP检查/总结、MCP授权与证据交集；两种inspection/display组合与fallback；最终runner反向display摘要 |
| 机器记录/历史读取 | 公共/私有v2、MessageRef、精确legacy aliases、unknown/raw；schema与校验snapshot；Tape另有严格兼容政策 |
| 前端/视频 | I04同frame显式locale/timeZone、实际PNG/MP4和哈希证据；当前前端48单测/types/build；实际6E2E回归见门槛日志 |
| 领域与接入等价 | S01/S04/S02/S03×SDK/ACP×两语16局，加2并行SDK局；机器events/全CP/request/actions一致，manual role/alive/winner/day/stage/actor与技能原人工oracle |
| 复现/资源/权限 | 每局实际Tape重放；同一角色的完整private轮数、无神信息/其他技能/越权狼聊、seer后续wire正向；ACP进程/MCP实际ESRCH |
| CI受控源码扫描 | lint:i18n纳入release；AST字符串/模板全段/JSX/Unicode Han；61 exact file/text/count+reason例外，增量/漂移/无理由fail；无整目录豁免 |

## 最终三路

- **A**：真实runner/factory未替换；脚本只替模型决策，不借World计算预期。ACPoptional分支按独立fix处理；required/error/timeout与owner不改。并行SDK隔离、manual日次/actor、positive seer与ESRCH已补。0剩余阻断。
- **R**：既有人工场景动作与规范一致，未把P4待修末神禁枪/重复白痴/自爆警徽固化成正确规则。核心组件仅展示locale/当前字段，资源/信息权限保持；S03终局残徽没有被认可。0剩余阻断。
- **L**：SDK旧tool history中文前缀已改中性tag并真实HTTP验证；未国际化的公开组件API已补bound locale，默认phase词表统一shared。受控scan逐组例外核实；现行gate文档更新、历史审查保当时事实。0剩余阻断。

## 主代理门槛

- 后端release：329通过/0失败，types、deps/boundary lint、i18n扫描、test及smoke。`/tmp/awa-p3-activation-release.log`。
- 真实整局矩阵：9 tests/4780断言；16顺序配对局+2并行局，每个18个Tape均实际重放。`/tmp/awa-p3-execution-matrix-final.log`。同一机器内容有意固定原始ASCII名字/模型文字，默认昵称语言另由bootstrap测试验证。
- 组件/源码scan：4测试39断言；实际SDK历史通路6测试25断言；ACPoptional/既有授权生命周期8测试52断言。
- 前端48单测/types/build通过。当前浏览器6E2E门槛由同轮真实Chromium回归确认；PNG/MP4实际渲染沿用I04证据，不重复无变更的编码测试。

未知locale仍由配置/模拟schema拒绝；旧Tape source/lock/RNG限制未放宽。实际通路使用本机合成provider/ACP，不访问外部模型或认证，也不声称完成Codex/Claude模型质量或P4全取消/混合矩阵。完整目标从P4继续，57计划角色和22机制后续范围保留。
