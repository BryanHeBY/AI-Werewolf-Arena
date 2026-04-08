# module maturity matrix

## 1. 当前代码详细文档

本矩阵用于标注 V3 后端模块成熟度，并作为后续迭代优先级依据。

| 模块 | 当前成熟度 | 说明 | 下一步 |
| --- | --- | --- | --- |
| `app` | stable | 装配入口稳定，支持多板子启动 | 增加注入开关（真实 LLM / Mock） |
| `config` | stable | V3 配置独立于 V2，已支持 board/maxDays/cycleDelay | 增加环境校验与默认值文档 |
| `domain` | beta | MVP 组件/系统齐全，支持守卫/女巫/猎人/白痴/警长基础 | 扩展高级角色与第三方阵营 |
| `engine` | beta | 严格串行 Night/Day/Vote 与事件拦截闭环 | 扩展复杂递归结算与更多 hooks |
| `gateway` | beta | Tool 鉴权与错误回弹可用 | 扩展全量 schema 与权限矩阵 |
| `memory` | beta | Notebook/Summary/ActiveContext 已接入 | 增加自动摘要策略与 token 预算器 |
| `scenarios` | stable | 6人/12人基准板子可跑 | 增加黑死病与扩展版型配置 |
| `server` | beta | V3 会话管理与 API/Socket 已接入 | 增加鉴权、多会话与观测指标 |
| `infra` | beta | 传输/日志/LLM适配可用 | 增加审计日志与失败重放 |
| `v3` | beta | Baseline provider + Scripted provider 可用 | 接入真实模型 provider |

## 2. 未来目标 TODO

- [x] 在每次里程碑结束后更新成熟度等级与证据链接。
- [x] 将成熟度与测试覆盖率关联（按模块展示）。
- [x] 对 `beta` 模块补充升级到 `stable` 的明确门槛。

## 3. 验收标准

- [x] 矩阵与当前代码结构一致，无失效模块名。
- [x] 每个模块具备“当前状态 + 下一步”的可执行信息。
- [x] 新成员可通过本矩阵快速识别高优先级改造区域。
