# Fragrant 原生双人查验状态 owner

## C20 的实际职责迁移

`pair-state-slot.ts` 接入两个真实消费者：profile 的原生状态初始化，以及 authority 中实际提交查验结果的写入。它使用原 authority 的四个字段，不增加 store、租约或每次读取生成的新对象。

`privateState.pairSeer` 和 `abilities["native:pair_check"].state` 保持同一个对象。前者是现有 CP 兼容表示，不能删掉或声称是两个独立状态库。初始化保留原单 assignment，先求值左侧 privateState，再安装并复制初始状态，最后赋兼容引用。

提交顺序保持：检查 ability descriptor、写原 pair state、更新 pair JSON、记录原使用次数、更新 ability JSON。authority 随后标记 lease committed、创建原 immutable receipt；requests 在实际领域提交之后 settlement。任何写入失败都保留已发生的原前缀，不新增 catch、回滚或退款。

三个原 descriptor/write/JSON helper 移到本 feature 的 `owned-state-data.ts`，由 Phantom 与 pair 两个实际 writer 使用。它们不是全局 store。原 roster、phase、current、candidate、knowledge、已付关系、close 以及独立 archive verifier 保持原职责。

## 证据

新四项 owner 测试、34 次字面/引用/求值顺序/前写失败断言通过；九项原授权、期限、关闭、已付知识/关系和 scope 撤权用例、59 次断言通过。源码与单独新测试类型项目通过。作者十四项固定 Git 原文/两 caller 逆替换证明和独立程序核对通过；五个职责头通过，整合架构门禁零新增失败。

独立冷进程验证原/现 catalog 都注册相同顺序的 55 个角色。直接导入具体 Fragrant profile 的原/现入口仍触发同一 Noble profile 的 WOLF_ROLE_PROFILE TDZ；原红证据保留，未把更换测试入口称为该债务已修。该初始化依赖债务随后在公开出口与注册装配阶段收口。

这完成复杂 Fragrant 的原生 pair 状态切片。其它资源、状态及不同机制的 close/abort 政策继续按矩阵迁移；没有将一次局部通过称为全机制验收。完整游戏/传输验证留到大阶段门禁。
