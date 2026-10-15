# ADR 0003：请求协议分类与领域完成

## 选择

复用RequestLease与RequestDelivery保存原登记、scope、alias传播、预算和一次完成；不新建平行lease framework。每协议显式决定共享域失效、alias自身失配、expiry和paid边界。

采用F02的窗口，正确观察原envelope／domain／earliest过期后单调关闭；已登记alias自己坏只退自己；unknown／wrong-owner不毒original。dynamic actor／phase／day／stage和声明pins是新可观察输入政策，不称机械等价。

## 理由

真实原行为characterization曾表明字段恢复可重新返回同scope；这不是凭静态布尔推断的“已验证漏洞”。修正需明确接受面与新预期，不能用新window策略统一所有既有复杂authority。

provider 返回、gateway 接受和领域全部付款是三点。已经声明事务完成合同的真实窗口，必须在其领域提交点通知 true；晚 facts 或通知错不得二结算，false 通知也不能覆盖原 body／cleanup 错误。未声明 completion 的原路径仍记录 Provider 候选，不能把这类 `action` 当成已付款，也不能为统一形式改成会丢失原候选的 deferred 错误。

## 后果

Wall 每作者、Cupid／Hybrid 每实际 request、LastWords 每真实 permit 分别完成。Seer 普通夜请求和死亡警徽选择采用各自领域 true 点；不能只凭 provider 返回或首字段写入即完成，部分失败仍 false 并保实际前缀，晚事实失败保 true。Ghost retained first consent 的共享失效与 second 自身 proof 坏分开；已付 chat／knife 保原规则。Animal／Fragrant／Noble 不因不同就自动改成同协议。

流光／蚀日的原始非法候选由真实领域路径消费后失败，归档与严格重放保留该候选及不完整 checkpoint。原Tape2的outcome不能同时保存返回候选和独立事务结果；这一历史限制保持，不回写旧档。后续八个真实Hybrid失败消费者暴露三次未付null重试无法exact重放：false-close覆写为error后，旧重放把第一条当Provider抛错，余下重试没有开启而进入因果死锁。该具体反例促成下面的Tape3修正，不推广全角色完成框架。

来源：[普通 Seer／警徽领域完成](../history/refactor/ordinary-native-badge-request-completion.md)、[C18a四协议](../history/refactor/request-lease-terminal-revocation.md)、[关系窗口](../history/refactor/cupid-hybrid-request-lease-completion.md)、[LastWords](../history/refactor/last-words-request-lease.md)、[Ghost](../history/refactor/ghost-bride-request-terminal-revocation.md)、[Demon](../history/refactor/demon-request-terminal-revocation.md)。

## 后继决定：严格 Tape3 保存被拒的返回候选

只在Trace实际settle(false)时保存此前安全复制成功的`returnedCandidate: ToolCall|null`，error与原结算计数不变。null是已知正常返回；字段缺席是未记录，不得猜成null。真Provider throw、copy失败或交付检查早抛不产生该字段；不增加请求、领域许可、统一付款或故障补偿框架。

重放仅在error且自身明确有候选时重交原值，原stage再次决定重试／拒绝／付款。旧无字段的error仍走原异常路径。false-close原因可能是无效回复、当前性／期限失效或partial；本字段不推断原因，不保证这些路径或通知异常都能exact重现。Cupid／Hybrid的独立核验把已知null、错工具或目标与unknown严格分开，最后决定的已知冲突不能借CP或早先选择绕过；合法候选只约束原来支持的partial前缀，不证明它已经付款。

本次同时更新writer、reader和版本：新严格writer写Tape3；reader保原Tape2shape且2拒新字段，3才允许该可选事实。envelope1只为strict允许内层2／3配对，public/player2及manifest1不变。旧reader不承诺读新3；结构／机制准入先于精确source检查，sourceHash变化按原门槛处理，不改历史fixture或来源身份。

原[八个失败窗口消费者](../../backend/tests/scenarios/failures/hybrid/required-affiliation-choice.test.ts)保exact重放断言。此决定不承诺任意外部安装失败或缺候选历史档都能重现领域partial；实际CP、facts、ops与错误前缀仍是独立约束。
