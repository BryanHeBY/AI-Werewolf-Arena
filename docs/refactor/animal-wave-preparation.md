# 动物梦境死亡波准备

本批继续 C28，完整原 `prepareAnimal` 闭包迁至本机制 `AnimalDeathWavePreparation.prepare()`，初始死亡波和每个追加提案两个真实消费者直接使用。公开 owner 只获过滤、原脱离权威查询、白猫到期提交与三类事实追加端口，不获 World、角色、库存或阶段控制。

保持原顺序：无本机制时返回原名单；复制提案并过滤；追加准备与可选揭示事实；复制有效名单与保留的放逐／河豚来源；删除被过滤白猫的来源；重复读取原 unit 和到期状态；提交到期并追加事实；去重加入死亡 ID 与原 Set 死因次序。后续失败不回滚已公布事实或已删除来源，不提前写 Alive。

unit 与 payload 使用具体 thunk，仍在原 World、事件参数之后读取。原生命／权威 guard 保持；两处原位非空类型断言只恢复 closure 丢失的类型收窄，不缓存或替换值。

四路径的完整 typed／ESNext／CommonJS 逆映射一致；Root 与独立子代理核对精确摘要、getter 与失败前缀。有限类型 19277 和局部门禁 52301 实际退出 0；中文职责头及新机制依赖无问题。新四个字面量边界用例通过／21 断言；原美人牵连白猫用例执行两个有界周期及追加提案，1 通过／5 断言，未改原用例或重跑整局。

初始类型红包含两处生产 thunk 的收窄与两个新 mock 注解，均按原表达式／测试输入修正，没有扩大公开权限。测试 mock 只模拟原合法端口结果，不假称制造真实 authority。

[有限证据](generated/animal-wave-preparation-evidence.json)。完整 TypedDeathWavePlan／CommitReceipt 与其余机制继续实现，十三项既有结算器内部依赖仍待收口。
