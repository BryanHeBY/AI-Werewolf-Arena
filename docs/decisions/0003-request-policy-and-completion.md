# ADR 0003：请求协议分类与领域完成

## 选择

复用RequestLease与RequestDelivery保存原登记、scope、alias传播、预算和一次完成；不新建平行lease framework。每协议显式决定共享域失效、alias自身失配、expiry和paid边界。

采用F02的窗口，正确观察原envelope／domain／earliest过期后单调关闭；已登记alias自己坏只退自己；unknown／wrong-owner不毒original。dynamic actor／phase／day／stage和声明pins是新可观察输入政策，不称机械等价。

## 理由

真实原行为characterization曾表明字段恢复可重新返回同scope；这不是凭静态布尔推断的“已验证漏洞”。修正需明确接受面与新预期，不能用新window策略统一所有既有复杂authority。

provider 返回、gateway 接受和领域全部付款是三点。已经声明事务完成合同的真实窗口，必须在其领域提交点通知 true；晚 facts 或通知错不得二结算，false 通知也不能覆盖原 body／cleanup 错误。未声明 completion 的原路径仍记录 Provider 候选，不能把这类 `action` 当成已付款，也不能为统一形式改成会丢失原候选的 deferred 错误。

## 后果

Wall 每作者、Cupid／Hybrid 每实际 request、LastWords 每真实 permit 分别完成。Seer 普通夜请求和死亡警徽选择采用各自领域 true 点；不能只凭 provider 返回或首字段写入即完成，部分失败仍 false 并保实际前缀，晚事实失败保 true。Ghost retained first consent 的共享失效与 second 自身 proof 坏分开；已付 chat／knife 保原规则。Animal／Fragrant／Noble 不因不同就自动改成同协议。

流光／蚀日的原始非法候选由真实领域路径消费后失败，归档与严格重放保留该候选及不完整 checkpoint。现有 Tape outcome 不能同时承诺原候选和独立事务结果；本轮保持这两类既有合同，不引入新格式或全角色完成框架。未来若有具体消费者确实需要两种事实，须另行规定字段、版本、调度和失败政策。

来源：[普通 Seer／警徽领域完成](../history/refactor/ordinary-native-badge-request-completion.md)、[C18a四协议](../history/refactor/request-lease-terminal-revocation.md)、[关系窗口](../history/refactor/cupid-hybrid-request-lease-completion.md)、[LastWords](../history/refactor/last-words-request-lease.md)、[Ghost](../history/refactor/ghost-bride-request-terminal-revocation.md)、[Demon](../history/refactor/demon-request-terminal-revocation.md)。
