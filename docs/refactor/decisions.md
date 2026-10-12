# 架构决策与迁移规则

## 唯一所有者

保留 World / ECS 作为实体与组件实际存储。机制拥有自己的状态槽及原始对象身份，领域拥有能力实例、授权和提交；引擎拥有阶段、波次和检查点。应用装配配置和会话资源。迁移不双写状态，不把授权变成 JSON，不建立统一 Agent 基类。

## 单向依赖

`game-contract` 定义惰性数据契约；`game-catalog` 提供目录元数据；`game-text` 提供语言；`game-presentation` 供真实后端和前端共同使用；`replay-contract` 管归档格式与兼容。规则支持判定属于 rulesets。adapter 只通过 observation / 请求端口接入。verifier 使用独立算术，不调用领域结算 oracle。

## 版本与复现

源码路径、注释、词典和包变更都可能改变 sourceHash。新增行为依赖进入指纹必须与变更同 commit。旧公共复盘按明确版本策略读取；严格 Tape 默认只允许精确 source / lock，跨构建必须有独立兼容证据，不能改写历史指纹。

## 因果词汇

selection 是输入选择；preflight 是当时可接受性；commit 是领域同步提交；payment 是一次性资源支出；effect 是实际生效；publication 是已告知知识。它们不是同义词。Night / ExileUnit / Wave / PhaseRevision 分别有生命周期；originPhase 与 executingPhase 分开。胜负候选、checkpoint 裁决、terminal commit 分开。

## 审查与并行

每个并行任务有具体文件所有权，核心时序切片顺序集成。分别审查架构 / 状态与权限、规则与失败因果、测试 / fixture / i18n 证据。实现代理不能替自己的更改完成唯一审查。机械迁移、文件移动和 F01 / F02 行为修正分开提交。

## 注释与边界

新建或实质修改的 TS / TSX 在业务 import 前立即补具名职责、输入输出、边界及必要生命周期契约。历史债务必须登记并最终清零，禁止重复模板冒充责任说明。角色公开入口保留完整规则卡与冻结规则链接。阶段和开发编号不继续成为长期生产模块名。
