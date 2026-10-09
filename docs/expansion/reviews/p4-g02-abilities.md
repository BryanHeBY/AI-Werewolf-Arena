# P4 G02 夜间能力实例交叉审查

## 范围与验证

三类能力实例、原生状态迁入、gift/copy/transfer、来源/知识、日期/次数/封锁、真实NightPipeline调度与绑定实例、两条Agent接入、JSON/严格Tape和双语呈现。契约见[night-abilities](../night-abilities.md)。未交付具体角色、死亡技能、女巫刀口/耗药后信息和G03/G04；没有将整个G02/M07或57计划角色标完成。

- 最终release:check：476测试、30135断言、83文件，类型/deps/模块边界/i18n源码扫描/test/smoke全部通过；日志 `/tmp/awa-p4-g02-abilities-release-complete.log`。
- 完整门槛含34实际SDK/ACP/混合中英六/十二基础对局及每局严格Tape；没有放宽source/lock/schema核对。
- 新赠予查验通路：中英×SDK/ACP共4测试、32断言，实际factory→HTTP或ACP进程/注入MCP→NightPipeline应用，平民身份不变，仅绑定实例消费、Agent/MCP退出；日志 `/tmp/awa-p4-g02-abilities-wire.log`。
- 人工能力判例23测试、181断言，日志 `/tmp/awa-p4-g02-abilities-target-hints-final.log`。多实例/状态转移、无原生牌阶段、阶段前后时点、请求前/后撤权/死亡、复制守护、用药None/资源、源披露、晚到自救、模板与JSON拒绝、actual CP/Tape及合法自目标提示覆盖。
- 前端54测试、365断言、类型/构建通过，日志 `/tmp/awa-p4-g02-abilities-front-{tests-final,type-final,build}.log`。未重复浏览器E2E/视频渲染，不将unit门槛冒充额外视频证据。
- 所有模型服务为合成本机服务，没有外部模型或用户认证。合成赠予贡献只验证基础接入与阶段，不宣称任意预注入状态或外部回调可跨引擎重放；实际角色完整赠予/Tape继续对应角色阶段。

## 独立发现、根处理与复查

| 审查方向                 | 发现                                                      | 根处理与最终状态                                                                                                    |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| R / review_scope_rules   | public grant可带transfer source，刷新次数且留旧owner      | grant typed/runtime只许gift/copy；专用内部transfer保uses/lastUsedDay/disabled，退役旧ID，伪转移无写入反例通过，关闭 |
| R                        | Native安装/更新保输入state引用，复用模板会串history/瓶数  | canonical deepclone，返实际owned state；同模板两实例与caller变更反例，关闭                                          |
| R                        | reset之后的新Potion继承过时canSelfHeal                    | 每次请求前和readonly规则按真实day/selfHealRule派生；Always晚到、FirstNightOnly首/次夜三实际阶段判例，关闭           |
| R                        | 获赠guard/potion仍用Villager targetHint，漏合法自目标     | 只在hint选规则时按bound kind映射，真实role/camp不动；两语prompt/preflight比对通过，关闭                             |
| A / review_arch_tests    | 合法optional undefined入库导致strict CP/Tape不合法        | canonical数据缺省缺键，native/grant/transfer统一；actual beginReproduction/CP/parse回归，未放宽JSON，关闭           |
| L / review_i18n_delivery | 数组forEach漏sparse hole，JSON会补null而strict parser失败 | 按index拒hole/undefined，native替换/grant前拒且无残留，关闭                                                         |
| L                        | transfer历史、getter/setter、DTO和低层day兼容声明不够明确 | statePolicy显式知识；setter两参数只native并返ownedstate，getter ID；required abilities与真实day要求明确，关闭       |

R额外建议原生角色文字不与新增能力矛盾、ID不能编码隐藏来源，均采纳；来源披露不等同于state知识授权。转移不能补瓶或清守护历史，旧知识仍在本人可见事件/会话历史，模拟投票读取已有私有结果。

A独立修正4测试/26断言（含actual CP/Tape）通过，最终0阻断；未重复完整门槛。R独立16/136及后续21/165，最终核对23/181与目标hint补丁0阻断；未重复完整门槛。L独立21/289和稀疏数组probe复查，核对21/165与最终target hint、双语、API范围0阻断。

三路最终0剩余阻断。首轮回归444通过/5旧测试PhaseDay失败已通过明确夜间fixture修正；最终未遗留失败。原生事件payload保持旧技能事实，新增赠予事件标实例，私有状态结构改变已在契约声明，历史播放器仍读原文。
