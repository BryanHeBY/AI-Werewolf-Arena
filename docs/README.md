# 项目文档

这里汇总 AWA 的使用指南、玩法规则、配置与运行契约、架构说明和公开示例。项目介绍与三条启动命令见[仓库首页](../README.md)。

## 第一次使用

1. 阅读[工作台指南](guides/workbench.md)，补充示例配置、连接模型并启动一局。
2. 按[配置契约](contracts/configuration.md)设置默认 Agent、角色／席位覆盖、玩家名字和自定义指令；Pi 原生配置见[接入指南](guides/pi-agent.md)。
3. 从[角色支持矩阵](contracts/gameplay-support-matrix.md)选择板子，结合[规则卡](rules/README.md)阅读玩法差异。
4. 对局结束后进入复盘；也可直接导入[公开示例归档](examples/README.md)，按[离线复盘指南](guides/offline-replay.md)查看事件和玩家私有输出。

## 按任务查阅

| 想了解的内容                             | 入口                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 网页配置、运行管理、日志、删除与回放     | [本地工作台](guides/workbench.md)                                                                                       |
| 独立前后端命令、配置检查与本地目录       | [本地运行](guides/run-locally.md)、[复盘前端](../apps/replay/README.md)                                                 |
| Pi 多平台认证与 ACP 文件隔离             | [Pi 接入](guides/pi-agent.md)、[ACP 启动器](../configs.example/acp/README.md)                                           |
| 角色来源、规则版本、特殊机制与可配置变体 | [规则 spec](rules/README.md)、[机制支持边界](contracts/mechanism-support-boundaries.md)                                 |
| 板子、游戏配置与两语教学归档             | [运行示例](examples/README.md)                                                                                          |
| 配置、行动、事件、玩家观察和归档格式     | [接口与运行契约](contracts/README.md)                                                                                   |
| 模块归属、状态写权和生命周期             | [架构 spec](architecture/README.md)                                                                                     |
| 视频、语音、字幕与美术                   | [视频制作](guides/video-production.md)、[离线语音](guides/offline-speech.md)、[美术规范](guides/video-art-direction.md) |
| 测试、真实模型评测与扩展角色             | [验证方法](guides/validation.md)、[评测指南](guides/release-evaluation.md)、[新增机制](guides/add-mechanism.md)         |
| 关键设计选择及理由                       | [架构决策](decisions/README.md)                                                                                         |
| 代码许可、依赖与素材授权                 | [MIT License](../LICENSE)、[第三方声明](../THIRD_PARTY_NOTICES.md)                                                      |

## 维护约定

- 完整玩法只在对应规则卡维护；代码说明职责与约束，并引用规则卡。
- 角色的资料状态不代替运行支持。具体板子还须通过 schema、角色组合和 ruleset 校验，边界见[机制支持契约](contracts/mechanism-support-boundaries.md)。
- 公共复盘、逐玩家视角及私有严格复现分别处理；可序列化字段不能授予运行权限。
- 自维护代码使用有效中文注释，说明重要数据结构和关键逻辑，要求见[新增机制指南](guides/add-mechanism.md)。

各目录索引维护当前有效内容；规则卡保留来源、实际行为和可复用判例。阶段计划、迁移台账、交接指令与逐次审查产物从 Git 历史追溯。敏感信息与归档发布要求见[仓库隐私维护](guides/repository-hygiene.md)。
