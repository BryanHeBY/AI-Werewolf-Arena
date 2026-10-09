# 本批实施与验收状态

基线：`eb4f026a38205d420cc2172b32fe23a29cb00da0`。实施目录：`/home/hby/dev/AI-Werewolf-Arena`。现有分支：`codex/rule-config-closure-20261009`。此报告只针对本批收口，不代表P8–P10或所有规则变体完成。用户后续授权在原目录实施、本地提交、同步项目依赖和离线fake transport测试；禁止真实模型、真实配置对局、推送/部署仍有效。

## 对照最初清单

| 项目                                       | 状态             | 交付与证据                                                                                                                                                                      |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI默认configs目录                         | done             | `config_directory.ts`供run/check/simulate/migrate统一使用，根目录/backend启动一致；显式/env相对目录语义保留；相应目录回归                                                       |
| 摄梦请求前撤权                             | done             | `dreamer/night_stages.ts`在每次请求前、构造后、await后、gateway后验证同一scope；已撤权不请求、不提交；21项摄梦scope及12项跨角色request-preflight回归                            |
| 女巫/守卫/预言家授权                       | done             | 复用严格ability_scope，女巫绑定source/readiness/disclosure等元数据；三者绑定实际夜晚，Seer/Guard请求构造后再检查；73项联合回归                                                  |
| 机械狼英文                                 | done             | 首夜只能学习与任意一夜一次学习同时表述清晰，澄清不是玩法修改；65项机械scope/资源/伤害回归                                                                                       |
| 前端完整类型门禁                           | done             | 55个TS/TSX（含scripts/unit/e2e/config）全部在strict/noEmit配置内；覆盖回归阻止漏检；没有ts-ignore/放宽flags/新增any逃逸                                                         |
| 后端完整测试/工具类型门禁                  | done             | 源码与220个tests/support TS、3个JS工具脚本均纳入门禁；合法action/request/事件fixture收口，官方bun-types；未排除坏测试                                                           |
| 统一回放事件reader/玩家关联                | done             | `readReplayEvent`给label、投影、关联共用，坏事实原子拒绝，未知事件不猜玩家/效果；文档shape和clone前拒绝getter；207项前端单测含1000+历史事件                                     |
| 展示DTO/黑市中性标签/阶段                  | done             | PresentationReplay与领域DTO分离，保留源seq间隙；奇迹/黑市能力与阶段中性标签；补齐实际24个遗漏，AST提取稳定阶段/事件/fixture验证完备                                             |
| 玩家ownState DTO                           | done             | 显式字段白名单与独立契约，不继承raw类型；梦history按结构过滤，unknown/getter不泄漏；观察副本脱离并冻结，原生/复制/赠予资源保持独立                                              |
| 工具描述与旧边界                           | done             | 机械/觉醒静态tool_names独立于runtime rules；扫描全部tool_specs无rules/state/profile/night-stage导入；只删无消费者的三个旧privateState键，公开兼容投影导出和活动迁移parser保留   |
| formatter/EditorConfig/前端lint            | done             | root format/check/lint门禁、Prettier固定版本、2空格/LF；frontend结构ESLint与backend依赖/边界/i18n门禁并行保留；独立机械格式提交 `78dc6a0`                                       |
| 已有参数往返/提示/录制/版本                | done             | 所有注册profile用schema/default/apply/serialize；共享strict BoardConfig schema，Tape重放直接消费验证后完整内部板子，保留合法legacy字段；源码/锁文件/ruleset/RNG不兼容先明确拒绝 |
| 后续授权的高置信规则配置                   | done（有限范围） | Guard `repeatPolicy` / HiddenWolf `campInspection`是版本化opt-in且保留默认，双语提示、DTO和strict Tape闭环；守卫A→无动作→A的真实录制语义分叉及隐狼两夜Seer/真实Knight回归       |
| 播放与无胜者浏览器收口                     | done             | `3496031`稳定逐帧inputProps；`01e74ca`使无音轨Player静音启动，不等待音频设备；音频resume挂起回归、切语言前后帧推进与终局/进行中双语比较均验证；最终78/78浏览器通过              |
| 新增完整平台/赛事preset                    | deferred         | 未完成PK/完整徽章交接、新夜序、扩展枪死因、复制库存/反噬/魅惑等整块机制；不能把两项参数称完整网易preset。逐项来源和边界见[规则证据](rule-evidence.md)                           |
| ObservedBot/provider全面重构               | deferred         | 按既定低优先级维护边界保留现有拆分，不扩大到无需求架构改写；全量fake SDK/ACP回归仍纳入验收                                                                                      |
| 真模型/GitHub认证/推送/部署/旧Tape指纹重写 | not-applicable   | 本批明确禁止，未执行；旧公开回放可读不等同旧Tape能在新源码严格复现                                                                                                              |

## 验收

backend全量已通过：2153项、0失败、185728断言、191个测试文件（790.34秒，慢项为本地fake ACP/stdio往返）。frontend全量已通过：207项、0失败、2025断言、31个文件。root check/lint/format:check、前后端build、git diff --check已通过；最后安全envelope修复后frontend类型/lint/全量单测/build再次通过。最终浏览器门禁在功能提交 `01e74cadb94abee2dfa50915c79c185b3100c2e8` 的固定源码上使用Node Playwright入口、已有Chromium、单worker完成：78项全部通过，0失败，退出码0（3.1分钟）。本次修复后frontend完整类型、lint、207单测、build、全仓format检查再次通过；最后夹具修正后类型/目标文件格式复验通过。后端源码未再修改，沿用上述全量证据，没有无理由重跑13分钟测试。

格式验证：648个文件独立机械提交；529个TS/JS AST等价（TSX编译后比较、属性名引号和括号等价归一化），36个JSON值等价；49个历史fixture哈希保持，`.env*`、本地configs、代理/凭据目录及录制产物均排除。大块格式diff可通过该独立提交隔开审查。前端ESLint是6条结构正确性规则；类型、格式与后端边界由独立门禁承担，不宣称覆盖所有React/type-aware规则。

前端构建通过，保留既有超过500KB的bundle提示；未新增code-splitting改造。历史失败保留：首轮2workers为77/78；Bun串行与后续Node完整轮曾出现76/78或77/78，不能用单项重试通过替代整轮结果。最新修复前完整trace轮为77/78：播放点击后切语言，5秒期间帧位置始终为0；无胜者这轮通过，但结果栏在响应完成后约5.1秒才出现，贴近既有5秒断言边界。实际终局标签逻辑无误。

Remotion当前版本在默认未静音的Player中会创建AudioContext并等待恢复，而ReplayComposition只有文字/图形、没有音轨。故障注入将AudioContext.resume保持未完成，修复前稳定复现同样的帧0/事件1超时；设置initiallyMuted后，同样故障下正常30fps推进，约3秒跨到事件2。这一证据确认纯视觉播放不应依赖音频恢复；结果栏长等待与音频初始化的关系仍是结合源码/时序的判断，没有冒充浏览器底层性能采样结论。

保留原5秒事件断言，没有跳过/提高超时或降低断言：强化用例先验证帧已推进，再验证换语言后继续推进，并仍要求事件2和正确暂停状态；无胜者用例新增同一浏览器重新加载合法部分回放后的中英“未结束”比较。新增夹具首次误填endedAt=null被契约正确拒绝，已修正为既有字符串时间戳，不放宽校验。最终定向2/2及完整78/78通过。

本机证据：`/tmp/arena-browser-final-78.log`（最终完整轮）、`/tmp/arena-browser-two-final.log`（强化定向）、`/tmp/arena-browser-blocked-audio-before.log`与`/tmp/arena-browser-blocked-audio-after.log`（同一故障前后）、`/tmp/arena-playback-failure-before-fix.trace.zip`（实际失败trace）；前端gate日志为`/tmp/arena-browser-fix-{types,lint,unit,build,format}.log`。这些临时路径不保证长期保留，提交中的测试和实现是可复现依据。本次没有额外生成PNG/MP4；实际Player浏览器门禁、共享逐帧单测和构建验证分别记录，不把它们冒称视频导出测试。

## Git与操作边界

原目录迁回后持续实施，没有reset/force/clean/stash或覆盖原用户改动。`main`仍为上述原始祖先；收尾可在干净工作区执行 `git switch main` 与 `git merge --ff-only codex/rule-config-closure-20261009`，本批只验证可fast-forward、不擅自合入/推送。额外worktree保留detached于 `7757745`，无写入者，未删除。后续按用户最新偏好直接在main线性工作，除非确需并行。

执行器原目录写入/测试所需权限已通过自动审批；无拒绝或需用户介入阻碍。Bun命令使用 `--no-env-file`；同步lock依赖使用frozen-lockfile和ignore-scripts，未全局安装或运行生命周期脚本。测试使用本地fake transport/临时记录和已有Chromium；浏览器的临时127.0.0.1服务器只服务fixture，结束后退出。

关键提交：`6a733b7`剩余DTO，`d23943e`隐狼策略，`c4f1737`请求前scope，`c27d3e6`守卫实际分叉Tape，`ad54596`最终回放安全envelope、`3496031`稳定播放输入、`01e74ca`无音轨播放与浏览器闭环；行为批次与 `78dc6a0`机械格式批独立。
