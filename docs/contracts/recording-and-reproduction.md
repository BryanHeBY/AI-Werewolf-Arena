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

ACP 玩家轮次中的请求增量保存实际交给 `session.prompt` 的完整字符串，包括新增可见事件批次、回合 ID 和行动提示，不再只保留末尾的行动说明。长输入按单消息 8000 字符上限分片且不切断 Unicode 代理对，同轮 prompt 分片顺序拼接还原原文。新增 `prompt_dispatched` 审计标记区分已经调用会话输入端口与尚未开始的请求；它不证明远端已读取、模型已完成或行动已经生效。

会话创建失败或输入前期限耗尽时，可以保留拟发送提示用于诊断，但实际请求增量为空，不伪造已经派发的模型输入。此改动沿用玩家 schema 2 的消息和审计字段，不改变公开事件、原始模型输出或复盘可见性。

三种后端在内部把提示内容与派发证据分开：SDK 在调用工具循环客户端前捕获完整消息，每次重试各记一份；ACP、Pi 记录交给原生会话的本轮增量。空派发集合表示尚未调用传输入口，不从拟发送正文回填。审计字段 `input_dispatches/input_modes` 声明次数及 `full_messages/session_delta` 模式；它们不证明远端已经收到。SDK 的历史窗口有明确起止与总数，原生会话仅声明历史所有者，不填虚假的零长度窗口。此记录不承诺捕获 SDK 内部每个网络步骤或工具循环自动追加的消息。

普通死亡后果由 `recording/verification/assembly.ts` 调用 `death-history/validate.ts` 独立审核；它不是运行许可或完整生命重演。

## Agent 输出分类

### 玩家昵称

昵称是可选的公开身份数据。manifest、God replay 和独立 player schema 2 文件保留显式 `name`，未配置时省略；旧文件缺席时仅显示编号，旧文件已有的名字保持原文。事件、行动目标和工具参数继续保存 ID，不为展示把昵称重复写入每个 payload。

当前 Tape3 的玩家元数据与 checkpoint 允许 `name` 缺席，严格复现沿元数据重建相同的字段缺席。历史 Tape2 仍要求原有姓名字段；本次没有把无昵称新档伪装为 Tape2。旧的 Tape3 reader 不保证接受新的无昵称档案；source／lock／规则身份检查维持原要求。

`game-presentation` 的 `playerLabel` 和 `createPlayerText` 供终端与 Web 共用。展示器显式接收本局公开名单，在已选词典模板的玩家参数位置补姓名，保留没有昵称时的原文案；日期、次数与技能 ID 不视为玩家 ID。姓名、玩家发言、思考和工具原文只插入一次，不通过整行正则替换修改，也不把 ANSI／HTML 写回结构化档案。

### 模型与工具输出

`AgentOutput` 是 LLM／ACP／Pi、终端、录制与 Web 共用的纯数据观察契约。归档继续使用 player schema 2：思考与消息分别写入 `assistant_output` 的既有可选 `name` 字段（`thinking`／`message`）；没有明确分类的 SDK／历史输出保持 `output`。文本按 8000 字符分片并保护 UTF-16 代理对，不通过终端显示开关裁剪私有原文。

工具仍映射为 `tool_call` 与 `tool_result`；原参数、候选接受信息、回执和白名单诊断沿既有字段保存。工具增量增加可选的 `call_id` 与有限枚举 `status` 元数据，用于关联真实开始／中间／完成状态；旧 reader 可忽略这些新增字段，旧档缺席时仍按原 `tool_call`／`tool_result` 解释，不补造进度。结构化记录不包含终端生成的 ANSI 或 HTML。

自爆确认的首份警示与第二份确认是私有 `tool_result`，保留 `confirmation_id`、`status`、`accepted`、`applied` 和原参数以便排查文本与工具矛盾。首份提案不写成最终行动，不生成公开自爆事件；未确认时最终行动仍为 `null`。精确复现依赖最终领域行动，确认编号不成为领域参数或跨回合授权。

### 可复现的交付期满

严格 Tape3 的 error outcome 增加固定码 `request_delivery_expired`，记录器只在本地交付期满异常确实关联本请求或其合法期限别名时写入。不保存请求对象、运行时完成身份或原始异常；交付断言拒绝后没有 `returnedCandidate`，也不能同时伪造该字段。旧 Tape2 仍只接受原来的 `decision_failed`，历史档案不迁移、不补造超时原因。这是当前 Tape3 接受面的显式扩展，旧版 Tape3 reader 不保证识别新码；引擎来源核验仍按原契约执行。

重放使用该固定事实向本轮实际请求交付相同的期满异常，不重造真实时钟、不恢复过期动作权限。普通遗言按机制登记的政策关闭后继续原阶段；严格请求保持失败。通用 Provider 错误、其它撤权和旧无精确原因的 error 继续走原失败重放路径。

CLI 将已知期满归为 `request_timeout` 并显示固定 `action_request_delivery_expired`；其它交付撤权归为 `action_failed`，不再把它们误标成网络传输故障。诊断仍只输出白名单字段。
