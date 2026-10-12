# 动物梦境夜间生命周期

## C23 第二个机制

`AnimalNightUnit` 收走原 NightPipeline 的 acquired/closed 标记、begin→opening fact、normal close 和条件 abort。原 Animal authority 继续拥有原体、Fox 资源、Cat/Puffer 死亡与实际放逐单位、stopped 状态；没有第二份 registry、epoch 或泛型 cleanup。

构造不读取 World、events、currentness 或 RNG。runtime getter 委托每次原字段读取。begin 成功返回后才记录 acquisition，随后原 appendAnimalFact 发布事实；发布失败仍 abort 已取得的夜。正常关闭先完成 authority 调用再记录 closed，finally 仍按 Animal→Fragrant→Noble 顺序，不吞错误、不退款。开夜自己失败则保持原 authority stop，不新增 pipeline acquisition。

## 证据

原 Git `23415df` 的 open/normal/abort 与剩余完整 pipeline 经四项明确 AST 逆映射一致；原 authority/facts 文件逐字不变。四个职责头通过。独立六个 fresh 原/现 NightPipeline、Bootstrap、CLI import 同成功及同出口，snapshot/Unit 具名引用一致，没有执行 CLI main 或模型。

三个有限单元、21 次断言通过：实际 world/current/world/events 顺序、正常关闭后 finally 不再读取、重复正常关闭拒绝、sealed fact log 失败前缀、原 currentness Error 与未取得窗口。原真实 Cat 首夜狼刀、警选、全弃票后的延期过期一项、7 次断言通过。有限类型检查通过，没有重复完整游戏。

首次测试误用了玩家 DTO 的 remaining 字段，原 native Fox 是 usedNight/history；只把测试预期改为原字面资源形状。原测试和 TS2339 红日志保留，没有改生产状态迎合测试。checkpoint、角色 ID、观察、随机和已有黄金档案不变。

C23 其他机制的 acquisition/handoff/normal/abort 仍须继续，不能以两个机制试点登记全阶段完成。
