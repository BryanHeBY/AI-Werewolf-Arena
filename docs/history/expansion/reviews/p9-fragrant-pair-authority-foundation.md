# P9d 寻香识命：唯一 World owner 与死亡发布凭据

前置纯状态提交 `4123d99`。两角色仍 planned，正式仍 **50/64**。本批是组件级所有权基础，没有注册角色／普通 NightAbility、工具、真实阶段、公开板子或复盘事实。

## 职责与状态

`fragrant_pair_seer/authority.ts` 私有绑定原 World、全部原 Alive／生命版本、Role／独立 Camp、私有容器、Identity 和 Victory。原始身体首次死亡仍可持有已付关系；组件替换、复活、状态实例或政策篡改均撤权。Bootstrap 的原生有限板资格及普通能力实例 scope 仍待下一切片接入，不能拿现有角色占位的组件 fixture 当新角色真实运行。

真实开夜先持有本夜、提交到期，N1 抽取恰一次；抽样后失败保留 aborted 夜，不能重开或继续重抽。刀权按调用入口原生命快照冻结，控制器／随机回调改变生命则明确失败；中途死亡不补刀。每个仍存活的魅影在开夜获得刀权通知，已消费、没有绑定请求也通知。`knifeNotices` 保存授权历史，`hasInheritedKnife` 为历史事实，`canVoteForKill` 只来自未关闭的本夜许可。

绑定与双查各有独立活人租约，任意已观察的撤权是终态，false／throw 后不恢复。双查在外部回调前快照输入，两个目标原身份同时校验，只提交一份目标对和布尔历史；不产生单体结果。正常收夜要求所有实际应请求选择完成，aborted 不把缺失当合法空过。请求关闭保留本周期已付关系，下一真实开夜才到期。

死亡波 prepare 只接受最终有效的原存活根，不消费；原全波同步标死后才 commit。两端独立同波死亡仅消费一次，`addedTargetId=null`，不声称新增死因。receipt 原 World／paid 关系／原生命固定，取消或复制的 receipt 不可重用。实际触发仍不修改玩家 `used`。

发布必须同时具有本局已提交 receipt、原 feed 自有数据槽中的公开死亡事件、未改写的原前缀／phase 事实、同周期和实际原生命死亡。拒绝外来数组方法、getter、跨 World、复制事件、先于波的事件、私有 audience、下一日事实和类型强制转换。玩家读取在 live-permit 回调后再次复验 owner，不能在晚替换后仍返回旧私有历史。

## 交叉审查与原反例

- R：抽样后失败可重抽、随机回调死亡可补刀、false 后租约恢复、throw 后接刀许可恢复。均迁入维护用例；失败保留 aborted，原生命快照、单向撤权及异常终结修复。原输入最终复验 **4／0／14 断言**，`/tmp/awa-fragrant-r-authority-controller-throw-fixed.log`。
- A：开夜重抽、可替换 `events.indexOf` 假授权、知情查询回调后替换原 Alive 仍返回私有历史。改自有槽读取和后复验；原两份输入原样复验 **6／0／14 断言**，`/tmp/awa-fragrant-authority-a-fixed-current.log`。
- T/L/D：N1 receipt 使用 Day2 事件、对象 `type.toString()` 获得死亡授权。严格类型／envelope、周期与前缀快照修复；原输入原样复验 **4／0／9 断言**，`/tmp/awa-fragrant-owner-publication-review-fixed.log`。

维护四文件 **49 tests／0 fail／215 assertions**，`/tmp/awa-fragrant-owner-tests-final.log`；源码／测试类型、源码 lint、模块边界和格式另核。上述只覆盖组件 owner，没有真实 PM／随机命名路径、SDK／ACP／MCP、独立 Tape、前端或完整对局证据。

## 下一切片接线要求

现有 PM 先发布 `night_resolved` 再调用 resolver。本板 receipt 要在对应公开事实之前 prepare，并在原生命全波真实提交后推进知情；实际接线须保留该有因果的时序，尤其是“双端独立死亡、唯一公告为 night_resolved”的场景。首日选举前自爆与待公布夜死合并时必须按最终有效波处理，不能沿用不同 roots 的旧 receipt。

独立双目标 NightAbility／最早 deadline 请求、真实夜序与单次命名随机路径、两处死亡波和来源／遗言／徽枪顺序、公共事实转换、录制 CP／独立账本／严格 Tape、实传、受限观察和实际前端门禁继续。角色数量及全目标保持，不推送。
