# 本批实施与验收状态

基线：`eb4f026a38205d420cc2172b32fe23a29cb00da0`。实施目录：`/home/hby/dev/AI-Werewolf-Arena`。当前分支：`main`。原实施分支已在工作区干净且无并行writer时ff-only接回main（b5387a6），后续线性提交，不推送。此报告只针对本批收口，不代表P8–P10或所有规则变体完成。用户后续授权在原目录实施、本地提交、同步项目依赖和离线fake transport测试；禁止真实模型、真实配置对局、推送/部署仍有效。

## 对照最初清单

| 项目                                       | 状态             | 交付与证据                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI默认configs目录                         | done             | `config_directory.ts`供run/check/simulate/migrate统一使用，根目录/backend启动一致；显式/env相对目录语义保留；相应目录回归                                                                                                                                                                                                                                      |
| 摄梦请求前撤权                             | done             | `dreamer/night_stages.ts`在每次请求前、构造后、await后、gateway后验证同一scope；已撤权不请求、不提交；21项摄梦scope及12项跨角色request-preflight回归                                                                                                                                                                                                           |
| 女巫/守卫/预言家授权                       | done             | 复用严格ability_scope，女巫绑定source/readiness/disclosure等元数据；三者绑定实际夜晚，Seer/Guard请求构造后再检查；73项联合回归                                                                                                                                                                                                                                 |
| 机械狼英文                                 | done             | 首夜只能学习与任意一夜一次学习同时表述清晰，澄清不是玩法修改；65项机械scope/资源/伤害回归                                                                                                                                                                                                                                                                      |
| 前端完整类型门禁                           | done             | 55个TS/TSX（含scripts/unit/e2e/config）全部在strict/noEmit配置内；覆盖回归阻止漏检；没有ts-ignore/放宽flags/新增any逃逸                                                                                                                                                                                                                                        |
| 后端完整测试/工具类型门禁                  | done             | 源码与220个tests/support TS、3个JS工具脚本均纳入门禁；合法action/request/事件fixture收口，官方bun-types；未排除坏测试                                                                                                                                                                                                                                          |
| 统一回放事件reader/玩家关联                | done             | `readReplayEvent`给label、投影、关联共用，坏事实原子拒绝，未知事件不猜玩家/效果；文档shape和clone前拒绝getter；207项前端单测含1000+历史事件                                                                                                                                                                                                                    |
| 展示DTO/黑市中性标签/阶段                  | done             | PresentationReplay与领域DTO分离，保留源seq间隙；奇迹/黑市能力与阶段中性标签；补齐实际24个遗漏，AST提取稳定阶段/事件/fixture验证完备                                                                                                                                                                                                                            |
| 玩家ownState DTO                           | done             | 显式字段白名单与独立契约，不继承raw类型；梦history按结构过滤，unknown/getter不泄漏；观察副本脱离并冻结，原生/复制/赠予资源保持独立                                                                                                                                                                                                                             |
| 工具描述与旧边界                           | done             | 机械/觉醒静态tool_names独立于runtime rules；扫描全部tool_specs无rules/state/profile/night-stage导入；工具规格已仅保留机器parameters，四角色26条及通用/警长23条重复中文描述退出例外表；getLlmSchema/getMany与旧gateway副本去除；legacy三个contributor、RoleViewRegistry、RoleSpecRegistry及冗余文案已删除，权限直接从活动RoleCatalog派生；活动注入/迁移接口保留 |
| formatter/EditorConfig/前端lint            | done             | root format/check/lint门禁、Prettier固定版本、2空格/LF；frontend结构ESLint与backend依赖/边界/i18n门禁并行保留；独立机械格式提交 `78dc6a0`                                                                                                                                                                                                                      |
| 已有参数往返/提示/录制/版本                | done             | 所有注册profile用schema/default/apply/serialize；共享strict BoardConfig schema，Tape重放直接消费验证后完整内部板子，保留合法legacy字段；源码/锁文件/ruleset/RNG不兼容先明确拒绝                                                                                                                                                                                |
| 后续授权的高置信规则配置                   | done（有限范围） | Guard `repeatPolicy` / HiddenWolf `campInspection`是版本化opt-in且保留默认，双语提示、DTO和strict Tape闭环；守卫A→无动作→A的真实录制语义分叉及隐狼两夜Seer/真实Knight回归                                                                                                                                                                                      |
| 播放与无胜者浏览器收口                     | done             | `3496031`稳定逐帧inputProps；`01e74ca`使无音轨Player静音启动，不等待音频设备；音频resume挂起回归、切语言前后帧推进与终局/进行中双语比较均验证；最终78/78浏览器通过                                                                                                                                                                                             |
| 新增完整平台/赛事preset                    | deferred         | 未完成PK/完整徽章交接、新夜序、扩展枪死因、复制库存/反噬/魅惑等整块机制；不能把两项参数称完整网易preset。逐项来源和边界见[规则证据](rule-evidence.md)                                                                                                                                                                                                          |
| ObservedBot/provider全面重构               | done             | ObservedBot按原生/复制/赠予/公共/狼人handler拆分，稳定优先级与null/undefined语义；3780输入动作/RNG次数对照一致；35条LLM及5条ACP测试AST原样拆分，共享fake客户端                                                                                                                                                                                                 |
| 真模型/GitHub认证/推送/部署/旧Tape指纹重写 | not-applicable   | 本批明确禁止，未执行；旧公开回放可读不等同旧Tape能在新源码严格复现                                                                                                                                                                                                                                                                                             |

## 验收

历史收口门禁（b5387a6及此前固定源码）：backend全量已通过：2153项、0失败、185728断言、191个测试文件（790.34秒，慢项为本地fake ACP/stdio往返）。frontend全量已通过：207项、0失败、2025断言、31个文件。root check/lint/format:check、前后端build、git diff --check已通过；最后安全envelope修复后frontend类型/lint/全量单测/build再次通过。最终浏览器门禁在功能提交 `01e74cadb94abee2dfa50915c79c185b3100c2e8` 的固定源码上使用Node Playwright入口、已有Chromium、单worker完成：78项全部通过，0失败，退出码0（3.1分钟）。本次修复后frontend完整类型、lint、207单测、build、全仓format检查再次通过；最后夹具修正后类型/目标文件格式复验通过。后端源码未再修改，沿用上述全量证据，没有无理由重跑13分钟测试。

格式验证：648个文件独立机械提交；529个TS/JS AST等价（TSX编译后比较、属性名引号和括号等价归一化），36个JSON值等价；49个历史fixture哈希保持，`.env*`、本地configs、代理/凭据目录及录制产物均排除。大块格式diff可通过该独立提交隔开审查。前端ESLint是6条结构正确性规则；类型、格式与后端边界由独立门禁承担，不宣称覆盖所有React/type-aware规则。

前端构建通过，保留既有超过500KB的bundle提示；未新增code-splitting改造。历史失败保留：首轮2workers为77/78；Bun串行与后续Node完整轮曾出现76/78或77/78，不能用单项重试通过替代整轮结果。最新修复前完整trace轮为77/78：播放点击后切语言，5秒期间帧位置始终为0；无胜者这轮通过，但结果栏在响应完成后约5.1秒才出现，贴近既有5秒断言边界。实际终局标签逻辑无误。

Remotion当前版本在默认未静音的Player中会创建AudioContext并等待恢复，而ReplayComposition只有文字/图形、没有音轨。故障注入将AudioContext.resume保持未完成，修复前稳定复现同样的帧0/事件1超时；设置initiallyMuted后，同样故障下正常30fps推进，约3秒跨到事件2。这一证据确认纯视觉播放不应依赖音频恢复；结果栏长等待与音频初始化的关系仍是结合源码/时序的判断，没有冒充浏览器底层性能采样结论。

保留原5秒事件断言，没有跳过/提高超时或降低断言：强化用例先验证帧已推进，再验证换语言后继续推进，并仍要求事件2和正确暂停状态；无胜者用例新增同一浏览器重新加载合法部分回放后的中英“未结束”比较。新增夹具首次误填endedAt=null被契约正确拒绝，已修正为既有字符串时间戳，不放宽校验。最终定向2/2及完整78/78通过。

本机证据：`/tmp/arena-browser-final-78.log`（最终完整轮）、`/tmp/arena-browser-two-final.log`（强化定向）、`/tmp/arena-browser-blocked-audio-before.log`与`/tmp/arena-browser-blocked-audio-after.log`（同一故障前后）、`/tmp/arena-playback-failure-before-fix.trace.zip`（实际失败trace）；前端gate日志为`/tmp/arena-browser-fix-{types,lint,unit,build,format}.log`。这些临时路径不保证长期保留，提交中的测试和实现是可复现依据。本次没有额外生成PNG/MP4；实际Player浏览器门禁、共享逐帧单测和构建验证分别记录，不把它们冒称视频导出测试。

## Git与操作边界

原目录迁回后持续实施，没有reset/force/clean/stash或覆盖原用户改动。`main`仍为上述原始祖先；收尾可在干净工作区执行 `git switch main` 与 `git merge --ff-only codex/rule-config-closure-20261009`，此前仅验证可fast-forward；用户明确要求main后已执行ff-only并确认HEAD/main同为b5387a6，未推送。额外worktree保留detached于 `7757745`，无写入者，未删除。后续按用户最新偏好直接在main线性工作，除非确需并行。

执行器原目录写入/测试所需权限已通过自动审批；无拒绝或需用户介入阻碍。Bun命令使用 `--no-env-file`；同步lock依赖使用frozen-lockfile和ignore-scripts，未全局安装或运行生命周期脚本。测试使用本地fake transport/临时记录和已有Chromium；浏览器的临时127.0.0.1服务器只服务fixture，结束后退出。

关键提交：`6a733b7`剩余DTO，`d23943e`隐狼策略，`c4f1737`请求前scope，`c27d3e6`守卫实际分叉Tape，`ad54596`最终回放安全envelope、`3496031`稳定播放输入、`01e74ca`无音轨播放与浏览器闭环；行为批次与 `78dc6a0`机械格式批独立。

## 用户要求继续全部原范围（未完成，持续实施）

本轮工具metadata切片：48项贡献的机器schema去除description后与此前完全等价；新增旧metadata抛错getter的真实preflight回归。后端源码/全部测试夹具类型、依赖/导入边界/i18n、构建、全仓格式及124项/1980断言定向回归通过。日志`/tmp/arena-tool-slice-final-{types,tests}.log`、`/tmp/arena-tool-slice-{build,format}.log`。这些定向门禁不冒称修改后全部2153项已重跑。

剩余原范围包括legacy接口/视图清理、ObservedBot handlers/provider大型测试拆分、预言家与女巫等约定角色规则配置、警徽选择/投票与完整具名preset流程。已保留默认并实现guard/hidden两项，不代表全部配置完成。P8–P10新增角色是单列未来扩展，不能混入本轮未完修复。矩阵随每块功能提交更新，最终需提供逐项验收证据等待用户验收；不得以“本批测试绿”宣布全部授权工作结束。

Legacy清理切片：23角色派生权限前后逐项相等；删除三个无人调用的文本contributor、RoleViewRegistry、重复RoleSpecRegistry及死WinCondition描述。活动RoleCatalog的自定义label/skillBrief/renderPrompt仍有真实消费者，TextLocalizationRegistry仍用于事件展示，保留。源码/全部测试类型、依赖/导入/i18n门禁、后端构建和73项/1067断言定向回归通过；i18n例外仅余4条兼容阶段别名及原生语言名。此后继续ObservedBot和provider拆分，整个原范围仍未完成。

ObservedBot/provider切片：ObservedBot只持有玩家RNG与样式，handler仅消费PlayerObservation；3,780组样式/日期/席位/资源/单或多工具输入的动作及随机数次数与此前一致。35条LLM、5条ACP原测试AST逐条一致；LLM由1635行拆为协议/回退/提示/审计文件，ACP拆开turn registry/MCP control/provider。全部类型、依赖/边界/i18n、构建与48项/295断言离线回归通过。日志`/tmp/arena-provider-split-{final-types,tests,build}.log`。剩余角色规则配置及完整警徽/投票/PK流程继续实施，历史全量门禁尚待全部源改动结束后重跑。

Seer策略切片：增加targetPolicy（活人默认/从未验过的其他活人）与actionPolicy（存在合法目标必行动默认/可跳过）两个版本化AWA产品枚举。查无目标跳过、await后历史变动拒绝，无隐式历史重置；所有四组合严格JSON Tape往返/恢复。80项/1382断言定向回归及类型/lint/构建通过，原请求默认min_valid_actions=1保留，纠正文档旧描述。尚待女巫信息/用药与完整警徽/投票/PK等范围。

女巫切片：保留selfHeal原三值，新增仅有两值的刀口披露策略与明确非已核验主流的`awa_both_native_experimental_v1`产品实验。默认一夜一药不变，实验用独立单动作第二回合、各一瓶、终止/重入保护及原生来源限制实现，赠毒/复制/转移不扩权。两个完整离线夜顺序的伤害结算已验证。策略变更也加入scope授权身份；3项新增请求构造撤权回归。171项/1588断言定向回归和全部类型/lint/build通过；日志`/tmp/arena-witch-final-{types,tests,build}.log`。仍待完整警徽/投票/PK及其余确有依据的原范围，整体未完成。

PK流程切片：新增有限AWA竞选/放逐策略，保留默认直接计票与既有tie-breaker；opt-in首轮平票仅一轮PK，候选人不投重投票，再次平票或全弃票不产生胜者。警长退水者首轮/PK资格区别、唯一候选直接当选、按配置票重放逐、非法目标有限重试和阶段/生命撤销均接入真实流水线。严格Tape两种策略实际录制/重放一致，候选公共事件有双语终端、玩家可见投影与前端共同reader。71项/23818断言离线回归、全部类型/lint/build通过；前端新增8项候选安全回归。日志`/tmp/arena-pk-final-{types,tests}.log`、`/tmp/arena-pk-{lint,build-backend,build-frontend}.log`。警徽持有者选择仍待下一切片；整体原范围尚未完，历史全量后端/浏览器门禁未冒称当前源码已重跑。

警徽切片：`badgePolicy=awa_holder_choice_v1`完整接入原生警徽状态、引擎临时死亡授权和严格单动作选择；来源/持徽对象/生命版本/日次阶段/候选生命晚验，授权finally撤销，继任保留票重，非法/无动作撕徽，白痴翻牌在该策略下直接撕徽。默认`awa_next_seat_v1`保持顺位行为。实际本地SDK HTTP与MCP业务回执一致且preflight不应用警徽，默认/选择两种真实死亡Tape完整复现。114项/1006断言定向回归（含构造/网关撤权及坏配置测试）、全后端类型、前端215项/2069断言、lint/format/build通过。源码继续推进到最终具名AWA组合板子与全量验收，历史2153/78项不能替代当前源码的全量重跑。
