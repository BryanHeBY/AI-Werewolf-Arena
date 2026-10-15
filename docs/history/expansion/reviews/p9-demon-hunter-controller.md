# P9b 猎魔人规范 controller 与真实接收层

接256b666。本批 controller 使用实际 GameActionRequestFactory、ToolGateway 与域授权，第二夜起规范 min1/max1/required_any、error/noFallback 请求，合法提交后才消费当夜槽位、同步 history／审计、settle receipt=true 并记录 accepted gateway op。缺失、非法、抛错、截止或撤权在 finally 关闭，不补动作、不写 history 或 accepted op；已提交不会因 finally 改为失败。

ActionReception 在通用复制／数字修复前严格解析 demon_hunt 并复验实际 request scope，随后透传该 scope。数字字符串、额外字段、getter／Proxy 均拒绝，恶意访问器执行零次。原请求与授权的短截止 clone 可以预检，等值复制请求不获得权限。外层 runtime deadline、SDK、ACP bounded request 均继承原绑定；预检不写域操作，不代表实际效果已经执行。

三组只读审查已完成，chain 发现的接收层缺 scope 与严格参数解析两项均修复并由原审查者关闭。97 pass／500断言的定向接收层／authority 验证通过；最新完整 engine＋recording＋既有 ActionReception transport 回归 **1946 pass／18800断言／92文件／0 fail**，日志 `/tmp/awa-p9-demon-controller-engine3.log`。backend type6、lintdeps3／boundary3／i18n3、build3 exit0，局部 formatter 与 diff 检查通过。首次 reception2 错误 cwd 缺 preload 已保留日志，改为 backend cwd；type3／type5 的候选工具比较与测试规格类型错误已修复后重跑，不算通过证据。

Demon 仍未公开 Role／tool／stage／schema／profile 注册；controller 与接收层判例通过显式候选 rule／spec 注入，不冒称实际 Demon SDK／ACP 全局、Tape 或完整角色已通过。真实 Witch 目标／库存／毒印配对、Night→PM 源冻结与死亡链、God／本人事实、faultPlan 与严格 Tape、四板双语三通路和前端／完整门禁继续实施。目录仍23verified／8implemented／33planned，总体待用户最终验收；仅 main 本地提交。
