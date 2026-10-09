# P7：公共严格行动失败策略

独立职责：将模型的干净等待与失败行动分开。`action_failure_policy: "error"`是引擎请求策略，缺省沿旧行为；策略不增加公开配置或启用新角色。本笔只提交公共SDK/ACP/MCP、记录、诊断与旧角色测试，Aw专有类型/阶段/提示/配置仍留工作区候选。

## 行为与所有权

- ActionTurn统一记录可归正确session/当前nonce的拒绝，三次后封闭，第四次不能变有效；一/二次纠错后valid仍可。stale请求不耗当前预算。
- SDK与ACP严格请求：干净零行动提交可以等待；无有效行动的提交/传输失败、超时或取消不能返回合法nil。严格策略不调用baseline fallback。
- 取消传播自己发起的AbortError，close只忽略同identity的预期pending取消，保留并等待真实资源清理错误。SDK同步解码收尾后还复验absolute deadline，避免timer未派发时把超时当等待；该复验仅启用strict。
- 生产AiSdkClient传递SDK早期invalid调用的safe name/id，不复制raw输入或Error payload。当前SDK loop错nonce失败也不能伪装clean wait，但不耗domain预算。get_game_schema/report_bug是辅助工具，其解析错误不成为行动提交，也不妨碍合法等待；两接入一致。
- MCP工具发现保持canonical schema，公开CallToolRequestSchema handler先safeParse相同输入；早期失败只经私有控制面给正确owner计拒绝，schema解释保持旧双语文案。辅助、旧nonce和未知session不污染当前行动预算。
- SDK首轮和mandatory重试、ACP失败都记录no_valid_action与原因，不伪造transport诊断。顶层诊断有action_failed。请求/Tape保存同一策略字段，删除或篡改实际记录策略拒绝重放。
- AiSdkClient私有fetch依赖供隔离合成测试，不能由JSON runtime config注入；测试不再更换进程全局fetch。

## 验证边界

当前工作区最终相关门槛367测试/6014断言/49文件通过，含真实本机HTTP、ACP进程/MCP、记录/审计/呈现与重放；frontend149/1296/24及type、backend type/deps/boundaries/i18n57登记例外通过。最初旧schema提示兼容失败已修；同轮监听不可达断言失败在窄复验通过，移除全局fetch替换后同完整门槛通过，不把首次2失败写成成功。

随后R审发现SDK同步收尾超时，新增绝对时间复验；最终定点deadline/调度/取消与4失败Tape门槛41测试/202断言/4文件通过，19/76公共策略专项包括缺省行为对照、真实cleanup错误和production SDK输入解析反例。公共MCP正式双语14测试/215断言：真实stdio、loopback、actual provider、schema不变、helper wait与stale、结构化失败及PID ESRCH。

最后A发现模型及时而同步记录收尾跨过deadline仍晚交付nil/valid，SDK和ACP都增加record之后和最终caller交付之前的strict截止复验，保request_timeout失败记录；四正式反例和独立两个probe通过，缺省不改。此时公共policy专项为23/88。

独立提交实证：由git archive HEAD加18暂存公共文件建立/tmp快照，三workspace包均解析到快照内部，排除所有Aw候选实现和其两份依赖测试。最终同步更新快照后的37测试/303断言/2文件通过，type/deps/boundaries/i18n57亦已核；初次快照遗漏跨包链接导致module-not-found，补齐临时链接后重验，未改仓库源码掩盖失败。

四项failure Tape用未提交Aw候选作为真实strict请求产生者，覆盖SDK/ACP两语、原error/部分checkpoint、无skip/无learn及删策略拒绝；它们是工作区候选验证，不冒独立公共提交已经启用Aw。本笔正式旧角色测试不依赖Aw。

## 独立审查

- A（review_arch_psychic）：取消、SDK坏JSON/错nonce、MCP早拒和ACP落盘、同步模型收尾/最终记录尾部两层deadline实证全部闭，最后限定增量0残留；两个原probe均拒迟到结果，支持公共职责提交，最终仓库/隔离门槛已终态0。
- R/T（review_rules_psychic）：最终R0；独立deadline/aux probes3/4、policy＋候选failureTape23/128，绝对时间及aux语义已关闭；要求Aw依赖测试留后笔，公共index隔离33/291已满足。
- L/D（review_rules_gargoyle）：SDK mandatory重试原因丢失已修；独立双语记录和safe元数据4/30通过、公共记录/i18n0残留，不冒Aw交付。

所有已启动验收进程已终态；未读取真实配置/认证或调用外部模型。shared catalog仍21 verified/43 planned，Aw完整配置、40seed/全部技能分支、最终60局矩阵/原12板/呈现仍随后完成；P7黑市商人与P8–P10、64角色/22机制、长局/T6保持。
