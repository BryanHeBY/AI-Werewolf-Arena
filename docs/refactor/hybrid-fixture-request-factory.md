# 混血儿夜间夹具补全构造器端口

真实基线 bec1f8854fd12c479a1a1098cc08313096c88f08。仅 affiliation-authority.test.ts 的现有 context helper 补必填 requestFactory getter，并说明已有 makeRequest 工厂闭包继续保持。Getter 返回已经导入的 GameActionRequestFactory，不创建第二实例，不改变角色、动作、World、RNG、断言或生产代码。

前笔丘比特／混血儿迁移的14根类型检查真实 TS2741 保留；原测试全文及旧叶有限覆盖确认同一缺字段问题。本笔是独立测试输入补全，新增 getter 确实进入 JS，不能宣称纯注释或运行输出相同。原笔红报告不改。

唯一失败根补后类型检查257f62/session44967→c6923e退出0；未重复其余13个绿色根或原绿色行为case。精确原稿正逆和两完整映射输出证明c4aebb退出0，七个直接 test 调用、62个 expect 表达式全文保持，实际两个输出因新增 getter 不同。一个职责头d962f5退出0、647当次公开文档路径，零诊断；两个现有运行契约／夹具builder控制源字节保持。

只修测试输入形状；其它配置身份、所有场景运行、全量类型、55角色和P9仍须对应验收。本例不执行模型、完整门禁或重写 oracle。
