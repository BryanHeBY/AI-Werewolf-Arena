# 请求、别名与领域完成

## 模型参数与旧调用兼容

`ToolSpec.parameters` 声明新模型应提交的参数形状。弃权与目标、模式与附属字段通过完整对象分支表达；确认动作只声明 `confirm:true`，迷雾目标声明去重。当前目标、存活、库存、权限与付款仍由机制规则判断，静态 schema 不授予这些能力。

确有旧格式的工具由自身同时声明 `legacyParameters`，接收器接受新旧结构后继续沿原修复和领域校验处理。旧格式不是绕过领域规则的许可。`use_potion` 的新无目标表达是 `{"potion_type":"none"}`；接收边界将它转成既有领域 ToolCall 的本人占位形态，避免改写事件及归档格式。这个内部占位不表示自救，也不消耗药剂。旧调用中的原目标保持原值与原规则，不批量清空或迁写旧档。

模型本轮参数说明及 `get_game_schema.actions` 从同一登记表生成，只发布新参数定义。LLM、Pi 和 ACP 共用该来源；通用 `submit_action` 包装继续接收结构化 `arguments`，实际回合允许集合与领域资格仍在接收器检查。

历史档案 reader 不使用当前模型 schema 重新筛选旧行动。格式读取和 Web 播放维持原兼容；严格执行仍需匹配真实构建身份，不能通过放宽 schema 或改写 sourceHash 绕过跨构建限制。

## 数据和运行权分离

ActionRequest的数据属于共享契约；World、Role、生命版本、库存、来源和真正lease仍是后端运行对象。context中的相同ID、allowedTools、MessageRef或已复制feed不产生权限，不能由DTO重新构造绑定。summary／retry原字符串覆盖与MessageRef保各自优先级，空串能明确清除内置提示。

provider返回是候选，不是accepted、committed或paid。接收器修复与schema／工具校验也不是领域付款。真实窗口必须接完整await两侧、validator后及语义首写前的当前性；所有新增callee／实参getter的观察点须如实注明，不能在最后守卫后又通过新增准备读点恢复未付路径。

## 已批准F02协议，而非全族统一规则

既有RequestLease持登记、scope查询、alias有序比较、继承、最早预算及运行turn；没有新的World服务或中央Role switch。各协议使用独立稳定实例，同request可有多binding，真实窗口只打开自己的turn。dynamic window的actor／phase／day／stage和可选context pins来自捕获scope。

在采用该F02政策的窗口内：

- 正确owner观察到原envelope／共享domain／最早期限失效，共同turn永久关闭，恢复字段或回拨时钟不复活。
- 已登记alias自身context／envelope坏，只永退alias；unknown clone／wrongWorld／wrong-owner只拒输入，不读取并毒化有效original。
- 合法deadline别名只能收紧有限未来预算；非法target pin／过去或延长预算在登记／预算写前拒绝。顶层原键／原值引用和context身份按该协议比较，不推成深JSON schema或freeze。
- close与settle不是同一事实：先落终态再通知；窗口按本族契约完成处理后才true，未完成的取消／异常为false。资源窗口仍核对其规定付款，部分付款保实际前缀；true已经落定之后的facts或通知晚抛保true且不二结算。

Initial／Wild／Lonely／Wall、Cupid110／Hybrid120／LastWords130、普通夜请求140及警徽150各有实际 scope 及完成点。普通夜协议当前接入 Seer，初次关联和后续 pin 要求原 `ability_id` 与捕获值一致；不为此新增 World 查询。Seer 的 slot、狐提案、checks、use、modifier、reflection 和自身历史全成功后、`seer_checked` 前才 true；警徽在旧徽／旧票重／新徽／新票重及特殊 frame 全完成后、事实前 true，null 销毁同样是合法完成。LastWords额外pin trigger/death_phase/death_action_id；关系窗口无额外context字段pins。LastWords没有独立库存付款，遗言事实push成功本身是提交，所以true在其后；此前sink错误为未完成。不能把所有facts一律当作true之后的晚发布。Wall每位作者独立完成，不能整个墙一个布尔值。

Demon／Ghost的已观察终态政策由各自原authority保存，不因此把所有paid current改成请求envelope检查。Ghost等待第二同意的旧first consent在共享domain失效被观察后退休；second自身proof／期限坏不无差别伤有效first。已付婚礼chat／knife保原纯读政策。

Animal／Fragrant／Noble等已有复杂协议按自己的正式同意／alias／原体和终态政策维护；不能仅因为与dynamic window不同就自动统一。新增协议先characterization，再明确行为差异和手写预期。

## 错误优先与记录

原body与原finally都抛时，保原JS cleanup优先；新增false通知不能盖已有原错，无旧错才传播新通知错。true先落后通知，晚失败不可再发false。Trace等待真实完成通知：defer=false即时结算和deferred领域结算必须区分。严格Tape3只在实际settle(false)时，保留已安全复制且正常返回的`returnedCandidate`（ToolCall或显式null）；`outcome`仍为error，不代表接受、付款或回滚。false-close也可能来自当前性／期限失效或部分提交；候选只证明正常返回，不记录拒绝原因。真Provider抛错／交付检查早抛没有该字段，缺席不能推断为null。Tape2保持原严格shape，不接这个字段。

未登记 completion 的原请求仍使用候选交付合同：Tape 的 `action` 表示 Provider 返回了该候选，不表示库存已消费或领域成功。领域结果还须核对事件、操作及 checkpoint。流光／蚀日同工具缺目标的失败复现正依赖这一区别：归档保留 `args: {}`，重放后由原领域路径失败，不能提前伪造成 Provider 错误。缺少通用 helper 本身不构成漏接事务的证据；新增领域完成合同必须先说明真实消费者和失败前缀，不把普通候选批量改成 deferred。

Tape3重放只在error且自身明确带候选时重交该事实，让原stage继续校验、重试和付款；旧缺字段仍在Provider点抛原记录错误。Cupid／Hybrid独立核验从最后一次决定读取已知候选，显式null／错工具／坏目标不能被CP或更早选择遮蔽；候选与合法部分付款前缀分别审核。此修补针对已存在的Hybrid三次未付重试消费者，不保证任意外部安装故障的exact replay。

实际owner：`domain/request-lease.ts`、`domain/request-delivery.ts`及每族真实window；SDK／ACP只消费完成端口，不夹入另一套付款判定。

## 期限耗尽与普通遗言收口

`RequestLease` 保留最早绝对期限和单调关闭规则，另外标记本次关闭是否确由期限耗尽触发。字段、原生命、阶段或领域失效优先按原顺序检查，不得因为同时超过期限就伪装成可恢复超时。

普通 `LastWordsWindow` 在开放真实交付窗口后，按完成身份登记“期满跳过”；严格授词／`action_failure_policy=error` 不登记。合法期限别名共享完成身份，因此 runner 绑定的请求与机制原请求可以识别同一份期满拒绝；相同 JSON、席位编号或外来异常字符串不产生此关联。

交付断言仍拒绝期满结果，固定错误码为 `action_request_delivery_expired`，旧 `message` 保持 `action_request_delivery_authority_revoked`。runner 只把明确可恢复且绑定本请求的期满异常交还机制，不提前关闭全局 Agent；普通遗言窗口不发表迟到文字，按原期满路径关闭许可与交付。其它撤权、严格请求、正文和清理异常仍保持失败语义。

回退也必须在原绝对期限内启动与交付。`awaitBeforeDeadline` 在调用前、微任务执行前和结果返回前复核期限，不能依靠 `setTimeout(0)` 尚未执行就生成迟到候选。期限已经耗尽时跳过回退，不延长预算；玩家档案中的最终行动为 `null`。

## Agent 工具执行回执

`ActionProvider.getAction()` 的数据接口仍返回候选，现有脚本驱动不变。模型可以在交出候选后继续等待当前机制的执行反馈；机制边界等待它的实际模型任务和录制收尾，而不是再次调用 `getAction()`。反馈用独立的请求弱关联通道传递已发表事件，不复用 F02 的 `completion` 或 `settleRequestDelivery`，不增加统一付款判断。

具体回包状态、接入范围与私有投影见 [Agent 工具执行反馈](agent-runtime.md#工具执行反馈)。没有结果事件、执行中断、明确拒绝是不同事实；没有可见事件不能推断尚未付款。新增机制应在自身工具规格中声明反馈事件，保持原资源写入及最终效果结算位置，先验证串行请求与取消反例。
