# I03 私有玩家记录 v2 与请求消息引用

## 新记录

players/player_N.json使用schemaVersion=2和可选locale。type由共享replay-contract拥有，后端reexport；writer持有写入，不能由展示模块选择记录字段。PlayerRoundRecorder直接保存request.phase/context.stage机器ID，并以同一机器phase生成request_id；去掉此前localizer构造参数。事件记录器既有机器字段和玩家局部可见seq不变，不把source_event_seq注入玩家协议。

System/user提示、assistant思考、工具参数/result以及发言仍为原文。locale只在session元信息已提供时写入，不由提示里的文字反推。writer在规范化玩家视角时调用共享assert，不能持有自称合法但违反嵌套类型的v2输出。

## 旧档

外部读取必须调用readReplayPlayerView。无schemaVersion或显式1接受已知旧结构后复制并转换为2；2校验复制但不反推中文，其他版本拒绝。只在role/camp、initial_prompt.phase/stage和timeline.phase/stage使用精确历史别名；未知值、request_id、nested event.payload、prompt/thinking/result/content均保原样。

历史day=0或负值仍保留供审计诊断，不擅自补日次。当前结构的seq/ID/role/kind/content/args/result等类型必须正确；JSON数组/对象不能通过字符串化冒充role或kind枚举。读取复制源对象，不改原文件。私有记录schema与公开v2、内部动作Tape各有独立边界，不能将私有资料导出给公开玩家视角。

## 行动请求

内置引擎说明使用summary_message/retry_notice_message MessageRef，携带key及可选scalar参数，不携带渲染后的中文句子。工厂深拷贝summary和retry消息，避免调用者变更已生成请求。SDK/ACP共用PlayerPromptPolicy，在World.locale下渲染；工具名、turn_id、day/stage、min/max/requiredTools、可见事件和实际合法性不变。

为旧/定制调用保留summary/retry_notice字符串。显式字符串优先于继承的Ref，包含空白或占位字样时原样保留；空字符串明确清除内置说明。没有字符串时才渲染Ref。内置新工厂输入由机制按阶段提供Ref；表示上警报名和退水的文案区分正确含义，不用“退警”混称首日是否报名。

内部动作录制的严格request schema同时接受legacy/raw字段和新Ref，Ref必须是当前共享key、scalar有限参数，缺参/多参/缺key明确拒绝。不通过默认文案回退掩盖错误。内部Tape继续source/lock/hash严格兼容；本批新schema为向后形状可选扩展，未改变其schemaVersion，跨引擎依旧明确拒绝。

## 验证

合成`packages/replay-contract/fixtures/board-unrecorded/legacy-player-view/locale-unrecorded/players/1-.player.json`同时包含中文/英文phase、未知phase/day异常及与术语同形的原文。人工断言只元字段转换、源输入不变、未来版本和嵌套坏类型拒绝。真实中英PlayerRoundRecorder→record作用域→文件保存检查schema/locale、机器phase/stage/request_id与原文。

工厂两locale生成的request结构完全一致；实际提示渲染语言不同、约束值不变，自定/spread/empty原文覆盖与消息引用深拷贝有独立回归。录制/完整对局/离线复现、真实SDK/ACP/MCP仍回归，严格Tape中坏消息引用也有真实parse拒绝。英文runner与内部英文复现已随P3实际通路/整局验收开放；I04/运行说明与诊断已交付，当前证据见[p3-activation](reviews/p3-activation.md)。
