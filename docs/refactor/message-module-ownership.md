# C15：双语词典的模块归属

1513 个消息键按 common、runtime、agents、replay、audit 与七组机制资料分到 12 个模块。每模块并排维护中立 key/参数定义和两语译文；403 个含参数的键明确原占位名，无参数键明确空数组。

机器键唯一来源仍为 game-contract 的 MessageKey/MESSAGE_IDS。中文保留原 literal 类型，英文保留原 string 宽度；MessageRef 的参数约束没有借物理整理强化。旧 formatter 继续独立负责用户参数拒绝与原文保护。

catalog 组合静态资料、检查重复 owner 与完整占位契约，再生成普通原型、浅冻结字典。中文键序复用原机器序；英文保留原两对历史交换。Root 从固定 `dbb47a1` 独立核 3026 个原 literal token、两语有序键值、占位名和每项 descriptor，全部相同；第三位代理复核 closed keys、排序与兼容出口。

源码扫描继续覆盖原三个应用根，并纳入 game-text 和后续 game-presentation。只精确豁免登记模块内顶层 zhCN 对象的直接译文字符串；同文件其它代码、元数据、动态模板和英文仍扫描。现有 file/text/count 例外逐字保持。

交叉审查发现初版 scanner 会跟随源根或祖先软链接、把悬空 optional 根当作缺失。已在文件系统根到固定源根的每段 lstat 拒绝软链接，只有真实缺失的 optional 根可跳；非目录、嵌套读取失败继续传播。三个原 synthetic canary 复核全部拒绝，未读取真实私有资料。

已有 formatter 4 项/3170 断言通过，原源码扫描同 5 个精确例外通过，新增根链负例和真实扫描边界局部测试通过；包内源码、closed type probes 与集成测试类型通过。没有重跑全仓门禁或修改译文、golden、fixture 来消除差异。
