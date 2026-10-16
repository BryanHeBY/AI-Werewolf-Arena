# 会话录制、checkpoint与独立复现

## 记录负责人

会话lifecycle持初始化、刷盘、closing／flush／finalize与资源关闭；session context隔离并行异步对局。内存aggregate不持磁盘封装；文件store只写单文件.tmp／rename，不承诺多文件事务或自己补终档。

JSON.stringify在宽写入catch外的既有位置，编码失败仍传播；宽catch不含任意后续日志／诊断throw。必需核心产品写入失败不得降成可选警告。运行和清理／保存同时失败按原owner保留原对象或AggregateError，不能靠统一cleanup吞掉一边。

## checkpoint与Trace

现场 checkpoint 捕获与装配归 `app/checkpoint` 的 contributions、authority-snapshots、identity-setups、player-snapshots、private-state-codec 五个完整 owner；纯 animal-format、player-format、animal-audit、noble-body-format、fragrant-pair-format 留在 `recording/reproduction/checkpoint`。

捕获按既有特殊 authority 优先和实际选择链取数据，保原引用／getter／JSON 时点；Demon 整 players 特殊贡献保外层优先，ordinary 完整 private 容器 clone 不按角色删扩展字段。玩家 DTO 的裁剪白名单不能用作 God checkpoint codec。

Trace记录issued request、selection／operation／完成及真实失败CP。completion由具体领域窗口在完成其既定处理后结算，不等同于库存付款：遗言没有库存，墙报的合法空回复或经窗口处理的拒绝也可以正常完成。涉及资源提交的窗口仍按其原契约核对付款；partial false保存已经发生的世界前缀。当前Tape3在实际false结算时保存已安全复制的`returnedCandidate`，outcome仍为error；真Provider抛错或交付检查早拒不保存该字段。历史Tape2保持原shape，不补候选；字段缺席不能推成null。候选、窗口完成和付款分别核对，具体完成责任见[行动请求契约](action-requests.md)，版本见[档案兼容](archive-compatibility.md)。

## 显式故障因果

受控外部换体必须作为离线输入进入既有 `metadata.faultPlan`，由录制和重放共用的故障所有者执行。`awa_fault_plan_v1` 保留猎魔决策后、夜来源冻结前的原协议；`awa_noble_request_fault_plan_v1` 只接受单步、具名的贵族请求正常返回边界，限定当前含猎魔者的 canonical Noble 板及 `secret_body`、`night_noble`、`awakened_idiot_reveal_speech` 三个窗口。新协议只用于严格 Tape3，不授予任意组件补丁或脚本执行能力。

贵族故障先替换声明行动者或所选目标的真实生命组件并消费步骤，再写入必需的 `noble_request_fault_applied` 因果操作；晚记录失败保留换体前缀，计划不能再次执行。正常返回候选继续交原机制复验，不能删除候选或根据错误码推测换体。独立审计交叉核对计划、候选、操作和末 checkpoint；精确重放按同一明确输入实际执行。未记录的任意测试闭包修改不具备这种复现保证。

## 三层不同保证

1. 公共reader：格式／已声明版本／payload和玩家关联合法，可读历史公开档；不执行规则。
2. 独立verifier：以档案可见字段做有限算术、写序和因果拒绝，不导生产owner、World或伪造life／lease精确证据。
3. exact replay：使用同一真实source／lock／RNG／ruleset原生执行，逐请求／事实／CP对比。

Cupid／Hybrid独立校验以同族最后decision约束末CP；已知回复必须匹配目标，只有未记录候选的末error／pending才可在明确范围内承载unknown partial。Tape3显式null、错工具或目标冲突不能由CP、更早选择遮蔽；合法候选也不证明付款。单有God事实不证明对象已死或合法资格。普通死亡历史校验同样不能替exact运行提供完整生命证明。

verifier按实际assembly原顺序追加贡献；board support保持独立的有限预设，不import生产支持算法充oracle。`recording/verification/<feature>`与生产features故意独立。

## 隐私与归档

God公开replay、私有manifest／reproduction及逐玩家档案的字段与身份分开。[档案兼容](archive-compatibility.md)列四类当前格式；完整原字段与原始prompt／thinking／tool内容不由文档整理或显示层再编码清洗。

普通死亡后果由 `recording/verification/assembly.ts` 调用 `death-history/validate.ts` 独立审核；它不是运行许可或完整生命重演。

## Agent 输出分类

`AgentOutput` 是 LLM／ACP／Pi、终端、录制与 Web 共用的纯数据观察契约。归档继续使用 player schema 2：思考与消息分别写入 `assistant_output` 的既有可选 `name` 字段（`thinking`／`message`）；没有明确分类的 SDK／历史输出保持 `output`。文本按 8000 字符分片并保护 UTF-16 代理对，不通过终端显示开关裁剪私有原文。

工具仍映射为 `tool_call` 与 `tool_result`；原参数、候选接受信息、回执和白名单诊断沿既有字段保存。工具增量增加可选的 `call_id` 与有限枚举 `status` 元数据，用于关联真实开始／中间／完成状态；旧 reader 可忽略这些新增字段，旧档缺席时仍按原 `tool_call`／`tool_result` 解释，不补造进度。结构化记录不包含终端生成的 ANSI 或 HTML。
