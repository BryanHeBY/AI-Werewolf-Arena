# ADR 0003：请求协议分类与领域完成

## 选择

复用RequestLease与RequestDelivery保存原登记、scope、alias传播、预算和一次完成；不新建平行lease framework。每协议显式决定共享域失效、alias自身失配、expiry和paid边界。

采用单调撤权政策的窗口，正确观察原envelope／domain／earliest过期后单调关闭；已登记alias自己坏只退自己；unknown／wrong-owner不毒original。dynamic actor／phase／day／stage和声明pins是新可观察输入政策，不称机械等价。

## 理由

同一请求字段恢复不能自动恢复已经撤销的许可。撤权范围必须按协议明确，不能将某一窗口的策略推广到全部复杂资源。

provider 返回、gateway 接受和领域全部付款是三点。已经声明事务完成合同的真实窗口，必须在其领域提交点通知 true；晚 facts 或通知错不得二结算，false 通知也不能覆盖原 body／cleanup 错误。未声明 completion 的原路径仍记录 Provider 候选，不能把这类 `action` 当成已付款，也不能为统一形式改成会丢失原候选的 deferred 错误。

## 后果

Wall 每作者、Cupid／Hybrid 每实际 request、LastWords 每真实 permit 分别完成。Seer 普通夜请求和死亡警徽选择采用各自领域 true 点；不能只凭 provider 返回或首字段写入即完成，部分失败仍 false 并保实际前缀，晚事实失败保 true。Ghost retained first consent 的共享失效与 second 自身 proof 坏分开；已付 chat／knife 保原规则。Animal／Fragrant／Noble 不因不同就自动改成同协议。

流光／蚀日的原始非法候选可在领域消费后失败，归档保留候选及不完整 checkpoint；不统一提前改成 Provider error。具体完成点见[行动请求契约](../contracts/action-requests.md)。

## 严格 Tape3 保存被拒的返回候选

只在Trace实际settle(false)时保存此前安全复制成功的`returnedCandidate: ToolCall|null`，error与原结算计数不变。null是已知正常返回；字段缺席是未记录，不得猜成null。真Provider throw、copy失败或交付检查早抛不产生该字段；不增加请求、领域许可、统一付款或故障补偿框架。

重放仅在error且自身明确有候选时重交原值，原stage再次决定重试／拒绝／付款。旧无字段的error仍走原异常路径。false-close原因可能是无效回复、当前性／期限失效或partial；本字段不推断原因，不保证这些路径或通知异常都能exact重现。Cupid／Hybrid的独立核验把已知null、错工具或目标与unknown严格分开，最后决定的已知冲突不能借CP或早先选择绕过；合法候选只约束原来支持的partial前缀，不证明它已经付款。

当前版本约定：新严格writer写Tape3；reader保原Tape2shape且2拒新字段，3才允许该可选事实。envelope1只为strict允许内层2／3配对，public/player2及manifest1不变。旧reader不承诺读新3；结构／机制准入先于精确source检查，sourceHash变化按原门槛处理，不改历史fixture或来源身份。

[失败窗口回归](../../backend/tests/scenarios/failures/hybrid/required-affiliation-choice.test.ts)保exact重放断言。此决定不承诺任意外部安装失败或缺候选历史档都能重现领域partial；实际CP、facts、ops与错误前缀仍是独立约束。

## 普通遗言期满不触发全局取消

普通遗言原窗口已有期满收口路径，但严格录制的交付断言和 runner 的全局取消先于该路径，曾把模型思考超时升级为整局异常。修复继续拒绝迟到行动，由真实遗言窗口按完成身份显式登记可恢复期满；runner 仅放行该具名拒绝回到原 owner 关闭，不把所有撤权统一吞掉。严格授词、原体／领域失效及清理失败仍传播。

期限断言的结构化固定码进入 Tape3，精确重放同一操作性失败；它不是已返回候选或领域付款，不改变 Tape2 接受面。回退本身受原绝对期限约束，耗尽后不再凭同步微任务竞争生成候选。相关三传输、双语完整局与无重放时钟的核验见 [遗言超时场景](../../backend/tests/scenarios/runtime/last-words-timeout-replay.test.ts)。
