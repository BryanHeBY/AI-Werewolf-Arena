# C25／C27：真实毒接受后的伤害证据

## 实际接线

单目标政策仅在原 `sources.push(Poison)` 分支成功时收集运行时来源。直接毒使用原已读 `hasDirectPoison`，反射毒保持独立 route；梦或觉醒盾阻断时没有 accepted 证据，不重新读取印记、World、库存或资格。普通死因排列、取消与清理顺序保持。

伤害系统把这些路由关联到同一个原结果，不改变原 deaths／deathSources／poisonReflections 的可枚举字段。独立 Symbol cause 身份和源／目标原体引用保留；不可枚举属性保存证据，WeakSet 仅登记结果身份。外部旧结果或 Proxy 不查询额外 metadata。

雾鸦原 copyDamage 在原字段复制完成之后，从已产生的 plain 副本筛选仍有 Poison 的目标并继承原路由。蛇仅移除原狼刀原因，梦扩展按原位置执行；不重消费印记，也不制造新的毒因果。证据是来源事实，不能当作死亡窗口或已提交回执授权。

## 中文说明与有限证据

四源码和一新增 unit 的职责、关键数据、接受时点、复制和权限边界使用中文，雾鸦职责头链接实际规则卡。原三个完整模块的执行程序按准确登记的 metadata 增量反移后相同；新增 collector／hidden 证据／复制过滤分别源审，不声称新接口对任意恶意 callback 完全等价。

新手写用例 5 通过、25 assertions：两个独立毒、梦保护、同目标反射但未生效的直接毒、延期副本与外部 Proxy。原雾鸦和伤害边界共 25 通过、117 assertions。有限严格类型检查 session 12174 实际退出 0；五中文职责头 0 问题。证据与独立审查见 [固定摘要](generated/damage-poison-evidence.json)。

## 后续范围

本批把真实接受的毒因果交给 DamageResolutionResult 和延期 owner。DeathWavePlan／CommitReceipt 的完整真实消费、其余效果族、时钟和最终同源门禁继续；不以查询入口存在宣称整条死亡链完成。不运行全量套件、游戏、发现、模型或网络。
