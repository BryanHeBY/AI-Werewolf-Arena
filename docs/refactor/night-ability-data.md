# 夜间能力数据的唯一声明位置

`game-contract/src/night-ability-data.ts` 集中七种能力的输入数据、有限读取形状及 kind、source、policy 和 suppression 数据类型，共 21 个声明。共享包根出口使用明确的 `export type`；浏览器类型环境不依赖后端、Node、World、许可或命令。

原字段、顺序、readonly、可选／null／undefined 及字面量约束保持。原生来源的 role 仍是 `Role` enum，未放宽为原始字符串或规划角色 ID。Radiant 的类型仍为原精确 policy 字面量，运行常量继续归 feature；Fragrant policy 仍引用已有中立事实类型。自定义初始化和额外私有键没有新的角色映射或 schema 限制。

后端仍拥有实际能力对象和读取视图的组合、安装复制、getter／writer、资源、许可、策略执行及玩家信息裁剪。内部 Witch 的 `potionTurnClosedDay` 不进入玩家 DTO。数据模块没有新 parser、schema、默认值或运行存储。

八个原声明 owner 及其实际 named／inline 类型消费者改用公共声明。无消费者的旧数据类型导出退出，Seer 的旧 `state-contracts.ts` 删除；getter 和功能 ports 的真实函数绑定保持，没有增加类型转发层。

本批实际范围为 54 路径。21 个声明成员及 42 项双向类型赋值核对通过；完整 backend 源码／测试、共享包 source 与 tests 类型检查实际退出 0。51 个保留原模块的 ESNext／CommonJS 程序保持，删除与新增的纯类型叶单独核对为惰性类型模块；23 个记录、schema、封印、独立 verifier 和玩家投影控制文件保持原字节。54 个职责头通过，没有新增依赖失败，5 条历史债务保留。

[本批证据](generated/night-ability-data-evidence.json) 记录输入、文件摘要、声明等价的明确限定和实际进程结果。没有重复运行完整对局、发现、浏览器或全量门禁。全部角色状态、schema／编码、custom profile 完整贡献、能力生命周期和其余旧入口仍按矩阵继续迁移。
