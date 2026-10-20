# 架构 spec

- [本地工作台](workbench.md)：配置编辑、运行管理、日志和回放的应用边界。

- [模块与依赖](module-ownership.md)：应用、领域、引擎、机制、规则组合、Agent、记录和适配器的职责边界。
- [状态、许可与生命周期](lifecycle-and-authority.md)：原体与版本、动作许可、已付效果、死亡波次和终局。
- [机制与共同服务索引](feature-ownership.md)：角色机制、共同能力和独立归档校验的源码入口。

数据格式与运行行为见[接口契约](../contracts/README.md)，玩法见[规则 spec](../rules/README.md)，有限组合与精确复现的保证见[支持边界](../contracts/mechanism-support-boundaries.md)。

维护一个流程时应能找到唯一状态所有者及明确输入输出；增加文件或转发层本身不构成职责拆分。
