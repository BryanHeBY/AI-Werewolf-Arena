# P4：白痴与警长公共参与资格

本子批落实[基础规则卡](rules/awa-classic-v1.md)的白痴翻牌、警长空候选/退水/零票规则。普通自爆三个扩展窗口与G04接续后续子批；不提前登记扩展角色。

## 单一公共资格查询

RoleProfile 增加 participation（静态值或纯状态函数），RoleCatalog 派生 canVote/canBeExiled/canBeSheriff；缺 profile 失败关闭，普通已注册profile默认允许。common/participation.ts结合当前Alive和VotingRight，供接收/最终规则、选举/放逐流水线、警徽、Baseline和提示共用。这里表达公开资格，秘密免疫应由结算hook处理，不能通过这个查询向目标提示泄露未知身份。

白痴首次被放逐时翻牌免死、canVote=false/weight=0，并移交或销毁警徽；翻牌后profile三项公共资格都为false。它仍可发言，狼刀/毒/枪等其他死亡正常结算。重复直接onVotedOut不重复写翻牌事件或改状态；正常投票已在共享接收和最终规则拒绝该目标。仅修改VotingRight不能抹掉已公开翻牌禁令。

## 警长选举

- 无人上警保留空候选；全部退水不恢复退出者；没有剩余候选时不请求警长票。
- 全员上警没有警下票，零有效票或全弃票都不选警长；单候选也需要有效票。本AWA选择不是默认无竞争自动当选。
- 只有具备投票权的最终非候选投票，合格的退水者可投票。翻牌白痴不进入上警/投票，也不继承警徽。
- 非弃票只接受实际合格的当前候选；无效目标不会暗中改投首个候选。正票平票仍按板子策略min_id/min_seat/no_elimination等处理。
- 每个请求的context独立复制；一名Provider不能修改其他请求或引擎候选数组。异步收集完成后再次核对当前演员/目标资格，迟到无效选择不写投票事件、不进入计票。
- 授予警徽先验证资格，失败不改已有徽章；转移使用原配置票权与最小合格座位。空最终候选的终端说明明确不开投票。

## 提示与通路

中英白痴规则/当前状态说明包含所有限制，公共板子提示说明无候选/退水/零票不选警长；目标提示过滤公开不合格放逐目标，并在警长票时只显示合格当前候选。注入的roleCatalog继续用于提示、接收和Baseline；低层选举/徽章API可显式传同一catalog。

ActionReception与最终gateway统一传ValidationContext.sheriffCandidates；两个入口都拒绝候选自己投警长票或失去资格的演员，不只在模型接收层拦截。新增stable codes sheriff_nomination_eligibility / sheriff_vote_eligibility有中英解释，vote_target说明更新为存活且可放逐。

受限ObservedBot继续按公开idiot_revealed事件排除放逐目标，真实流水线不会请求它执行已失去的行动。它不读取World或其他人的privateState。本批没有把公共资格DTO改成隐藏角色状态清单。

## 兼容与证据

assignSheriff改为返回boolean；非法授予保持现状。非弃票的低层警长gateway调用必须提供sheriffCandidates。正常入口使用真实选举传入；无候选时不造虚假投票回合。

公开/玩家记录v2和事件字段不变，候选/投票/当选数量按纠正规则变化；旧档原话与原顺序保留。内部Tape继续严格source/lock/rules兼容，不把旧错误行为自动迁移成当前对局。

[人工判例](../../backend/tests/engine/rules/participation.test.ts)覆盖白痴一次翻牌/资源与警徽、资格不被独立组件覆盖、其他死因、空候选/全退/零票/全候选、退水票/非法票、正票平票、跨await资格撤销、候选副本隔离、注入目录与提示。真实SDK HTTP/MCP双语拒绝与既有完整对局/严格Tape作为传输门槛；不用只验证低层字段来宣称完整角色扩展完成。
