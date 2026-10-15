# Noble 请求撤销的显式换体因果

前态 `607b09f5` 的十项原真实传输测试均复现失败：八项 unexpected_request、两项 checkpoint_mismatch。首局测试闭包在 Provider 正常返回后替换 Alive，却没有把这次外部变更录为因果；Tape3 正确保留正常候选，严格重放因而继续旧生命的动作。本批保候选和所有原严格断言。

复用原故障所有者，新增单步 `awa_noble_request_fault_plan_v1` 离线输入：只在当前 canonical Noble 板的三个具名请求正常返回后替换声明 actor／所选 target 的生命，并必需记录 `noble_request_fault_applied`。metadata 进入原 bootstrap 重放，同一 writer 实际执行；原测试 spy 只观察原引用。既有 Demon gate、v1 来源冻结与审计保留。无计划的普通对局不增加 Provider 代理。

| 后继同源有限验证 | 实际结果 |
| --- | --- |
| 2 份故障边界单元 | 36 通过、0 失败、108 断言 |
| 原十项 Noble＋41 项旧 Demon 场景 | 51 通过、0 失败、5261 断言 |
| 完整后端测试类型项目 | 退出 0 |

首次整合的运行测试已绿，类型检查五项诊断通过三处擦除断言、旧断言泛型及新请求 fixture 必填字段修正；后继重新执行同源场景。两项新手写风险核对真实换体／唯一记录和记录器同一 Error 下的部分提交、不二写。关键结构、时点和 Voting 职责采用中文注释，契约见[录制与复现](../../contracts/recording-and-reproduction.md)。

[独立审查](noble-request-fault-causality.peer-review.json)批准准备源和实际后继；[收据](noble-request-fault-causality.receipts.json)与[封包](noble-request-fault-causality.tar.gz)保存真实首十红、首类型红、后继与旧轮分类。旧轮7200秒超时及另外两处 pending 输入红继续保留其原状态；本批不宣称最终 C47/C48 完成。
