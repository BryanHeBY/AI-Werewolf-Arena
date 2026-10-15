# 角色名称词典归属收口

以 `8dd28e93` 为实际整合前态。角色名称的唯一生产字典迁入 `game-text`，`game-catalog` 只保留稳定资料；同时删除 text 对 catalog 的依赖。64 个 ID、128 个中英文名称及原排列保持，包含 55 个已支持角色与 9 个仅规划 ID，未增加玩法。

`game-catalog.roleName` 与资料的 `names` 字段退出，消费者从 `game-text` 取得名称。默认中文、非法 locale、未知 ID 原样回退、自定义空文本等行为保留。[迁移说明](../../guides/migration.md)记录接口变化。

| 有限验证                              | 实际结果                           |
| ------------------------------------- | ---------------------------------- |
| 新字面用例对旧生产实现                | 3 通过，152 断言                   |
| catalog 包                            | 5 通过，215 断言                   |
| text 包                               | 8 通过，3323 断言；包含上述同 3 项 |
| 四份后端消费者测试                    | 25 通过，4205 断言                 |
| 两包 source/test 与后端 test 类型项目 | 5 个项目全部退出 0                 |

真实执行绑定 13 个源／测试／依赖文件及 7 个控制输入；两份发布说明未冒充功能测试输入。源码指纹输入由 913 增至 914，仅新增名称字典，sourceHash 与 lockHash 按实变化。

[收据](role-name-dictionary-owner.receipts.json)、[有限终审](role-name-dictionary-owner.peer-review.json)、[原始封包](role-name-dictionary-owner.tar.gz)保存准备、首次格式证明拒绝、后继及全部原始输出。本批不声明完整 C47 或重构目标通过；运行扩展窄端口和请求准入职责仍待完成。
