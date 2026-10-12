# C08：关系、初始化与道具事实

Cupid、Debate、Ghost Bride、Thief、Shapeshifter、Wild Child、Lonely Girl 和 Wall Notes 八组数据与惰性读取器迁入契约。原程序仅改变共同 copier 与 RoleId 类型进口；ID 上限、数组限额、可空字段、顺序和 Unicode 文本合法性不变。

`freshGhostBrideState` 只是原 JSON 默认模板，实际库存和关系仍由领域拥有。Wall 的 160 Unicode code point 及代理对检查没有改成 JS 字符串长度。事实读取不渲染文案、不接管有限板子支持判断，也不构造运行租约。

独立审查核对固定 `80ce15f` 原声明与具名兼容出口；24 项包内局部测试及 3 项独立字面探针通过。前端原八个显示测试文件共 27 项、349 断言通过。5 个引擎、受众、录制及前端消费者只改变公开 import 和职责头，非 import 正文保持。

目前 22 个独立事实模块与共同 copier 已归契约，文案兼容入口待 C44 清除。原本内嵌在 label 中的读取条件仍待单独拆分；这批不将其假定为已经统一的事件解析管线。
