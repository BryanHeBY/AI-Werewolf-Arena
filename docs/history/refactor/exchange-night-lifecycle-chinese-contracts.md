# 魔术师／诡术师夜间生命周期中文契约

## 范围

实际输入为 `d92d0a4033367ad5b3bdb15f44f75a3b352b46c6`，两源码字节也与阶段固定 `5d42b6f8` 相同。只修改 `magician/night-lifecycle.ts` 和 `trickster/night-lifecycle.ts` 的中文职责头及结构／时点说明，14 条精确注释记录。`wolf_sorcerer/night-lifecycle.ts` 完整原 Git／当前字节保持，不改三族调用方或阶段。实际中文名按现有 profile／i18n 为“诡术师”，机器 role 值保持。

## 已核对的真实职责

- `night-lifecycle-plan` 在原 finishPipeline 时点传入 `config.magician !== undefined` 布尔值。魔术师单位只赋值 transferred（包括再次 false），不是保存配置原引用、成功开夜回执或行动授权。狼术师和诡术师共读同一个冻结的移交查询；它仍读取该单位当前布尔值，没有复制第二组移交状态。
- 构造保存原 runtime／ownership 对象，不执行 World getter。单位先判自己的 transferred 或调用共享 isTransferred，未移交才读取原中止函数与 runtime.world；查询和 World／frame 错误沿原栈传播，不加重试、acquired／closed 守卫或退款。
- 经理原 receiveExchange 接收同一三族单位；终结字段保存原方法值，World／day 来自当次经理调用。方法表冻结只保护表，不授业务许可，不缓存参数或保证关闭幂等。正常关闭、重复调用与中止政策仍由 frame 决定。
- 魔术师 priority=80、诡术师 priority=100 的开夜仍归原阶段。诡术师正常完成由 frame 标记 finished，保留随后放逐映射；原 abort 只在存在夜窗口且尚未 finished 时关闭，不增加外层周期清理或结算放逐。

实际阅读 NightPipeline／PhaseManager、共享 night-lifecycle-plan、三族单位与端口，以及两 frame 的正常／abort 边界。这里只维护说明，不改变这些程序或扩大权限。

## 有界验证与限制

`cb723f` 真实退出 0：两源码完整实际 Git 精确注释 forward／inverse 均相同，333 个完整非注释 token 保持，稳定狼术师控制全字节保持。只作低影响注释对照，未重复已有算法 AST／编译输出证明。

`c87945` 原 checkComments 精确两 roots 一次真实退出 0，输入 537 个同 Git 文档路径，职责诊断和中文首头缺失均为 0。字段形状不代替独立语义审查；没有新增测试、类型检查、模型、全门禁、产品文案或历史证据修改。

[冻结源与证据](generated/exchange-night-lifecycle-chinese-contracts-evidence.json) 保存实际 before、精确编辑、最终两 SHA 和真实收据。没有修改 Git／index、progress或共享矩阵，不宣称完整 C45 或生命周期重构全部完成；Root 与同行独审后按功能提交。
