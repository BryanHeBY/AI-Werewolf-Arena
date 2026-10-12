# 寻香夜间生命周期

## C23 首个机制切片

原 NightPipeline 中寻香的 acquisition/closed 标记、开夜事实、正常关闭和失败 abort 归具体 `FragrantNightUnit`。生命周期单元每次执行独立创建，没有第二个 World registry、额外 epoch、泛型 cleanup 框架或新的 handoff 标记。原 authority 继续拥有原体、行动许可、知识及已付关系；阶段推进和死亡结算仍归 engine。

原执行顺序保持：开夜前 authority snapshot → 原 begin 参数位置的 lazy RNG factory → begin 内唯一实际知识抽取 → 开夜后 snapshot → acquired 标记 → 原 opening/expiry/notice 事实 → mandatory recording。World/events 通过委托 getter 保留每次原字段读取，构造不读取 World/current/RNG。记录语句留在 engine 的具体 callback，feature 不依赖 recorder 或文件 I/O。

正常关闭先调用 authority，再记 closed；失败 finally 仍按 Animal、Fragrant、Noble 原顺序执行，不汇总或吞掉原异常。已付关系及知识不退款。原开夜后 snapshot 失败时 acquisition 尚未登记的边界有单独字面测试，未擅自提前标记或增加补偿清理。

## 验证边界

原 Git `a828601` 的完整 opening、recording callback、normal/abort 及剩余 pipeline 经明确映射后的五项 AST 比较一致；不是格式化后的字节完全相同声明。四个职责头和新的依赖边界通过。独立审查核对 eight 源码条件、委托读取、唯一状态及错误顺序；原/现 NightPipeline、Bootstrap、CLI 六个 fresh cold import 同成功及相同出口，CLI 未执行 main。

新增四项有限单元、24 次断言通过，覆盖实际读取/抽取/事实/记录顺序、mandatory recording 失败、正常关闭后的 paid binding 与 finally、开夜后读取失败前缀。原 N1 实际狼刀、连锁死亡、遗言与警徽一项、6 次断言通过。没有重复完整对局或浏览器。

并行 C24 新 required context 尚未接线时，当前工作树类型检查会报四处缺字段；这不是本笔类型通过证据。另以固定 Git `d3c6f1d` 加本笔三个源码的精确 overlay 编译 667 个公共源码，0 diagnostics，manifest 保留每份输入摘要。第一次虚拟编译遗漏 configFilePath 产生 Node ambient 错误，修正原配置身份后通过，没有放宽类型或忽略错误。该 isolated candidate 对应本笔实际提交；C24 接线后再完成工作树整合检查。

本切片只完成寻香具体生命周期。其他机制的开夜、handoff、normal/abort 和各自重复关闭政策继续迁移，C23 尚未全部完成。存档字段、checkpoint revision 和玩家观察不变。
