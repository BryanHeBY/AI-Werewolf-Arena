# 幸运夹具请求构造端口补全

独立于已提交的夜能力库存职责迁移。本批基于实际 `b05f9067b499df4056acf33e3b37c202d1fdc54f`，只修改 Lucky 原测试源，在 `context()` 的返回值中添加 `requestFactory` 惰性 getter，返回原已导入的 `GameActionRequestFactory` 构造器。原 `makeRequest` 继续复用已有实例；没有第二次 new、替换工厂或改动动作／预期。

原 A35 首类型中的 TS2741 已在原 bd106 34文本有限覆盖视图里复现；本次输入补全是实际新增运行字段，另笔提交，不冒机械行为等价。新注释区分 Ctor 与实例，原有效中文头保留。

只复此前失败的 Lucky 一根：`39cdcf` session90479 → `3bf258` 实际 exit0；其余33绿根不重复。单头 `235110` 首次0、657实际 Git 文档；完整证明 `5c0bf3` 首次0：原全程序精确正逆5833节点／3938非注释叶、两完整输出保持；实际新增 getter 使两实际输出不同，明确记录。原8个直接test、42个expect、16个new表达式和makeRequest整正文保持，Ctor import仍同原实际声明。

原 NightStageContext 契约和既有 builder 两控制与实际 Git 字节相同。未复原已绿case、全门禁或模型；这只关闭该已证实夹具缺项，不代表全库类型或P9完成。详细原文、精确编辑、有限配置与真实收据见同前缀 generated 文件。
