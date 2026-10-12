# P9e 河豚原票／主动资源与刀死底座

前置 `9ec3d58`。本切片继续同一个 World 资源 owner，增加可信投票器整轮输入、反击决定和原刀死生命周期。仍无 Profile／公开配置／PM／实际录制／玩家投影或角色验收；正式 **52/64** 不变。

## 真实 owner 约束

- 每个实际放逐单位须记录完整当前合法选民的原票（含弃票）并 seal；严格核原活人、票权及1/1.5权重。普通自票合法，一张1.5票仍只有一个原选民。首轮最高平票需真实一轮 PK，候选不得投票，PK候选集合必须与首轮接受票一致。
- 首轮／最终轮分别留原票与原玩家引用。final政策在PK全弃或终平时不回退首轮；first政策仍用首轮原票。目标全集由owner计算，不接玩家自选子集。没有合法目标无请求、无消费。
- 有合法原选民且原活河豚资源可用时必须作一个bool决定。false保整局资源，true只消费一次。最后外部阶段回调后复核全部原目标与资源／token／最早期限，任一撤权不缩成子集、不付款。
- 自己的付款回执只有 `{day,activate}`，原票、目标、库存与被动时钟留God canonical。资源/payment不写Alive；失败快照保已付完整集合，不把未提交生命编造成死亡。
- 实际单位 prepare 须先seal并完成必答河豚决定；normalclose等待主动全集原目标首次真死或白猫实际延期，另等待本单位Cat应到期真死。raw测试手动设置生命仅模拟将来独占DeathResolution消费者，不能代替实际死亡链证据。
- 每次真实开夜锁原河豚的活状态与生命版本。被动只接受该夜正常handoff之后、夜初原活人本夜首次真死且可信最终来源含WolfKill；旧死亡、starting/open、重复刀死均拒绝。主动用过仍可被动，下一成功真实开夜清临时Beauty日封禁，历史库存不退款。

`recordAnimalBallotRound` 是后续受信 VotingPipeline 的写入入口，不证明任意传入对象经过gateway；刀死函数仍信任实际resolver给的最终来源，尚不是独立来源凭据。真实编排、source receipt、公开时点和独立Tape账本继续接入。Beauty fail-closed查询只作引擎权限，不能据撤权返回true向玩家通知真实河豚被动。

## 独立审查与修正

A原反例发现三类P2：旧首次死亡可重用为新夜刀死；活人畸形／getter票权被静默当无票权排除；第一个外部回调可改写尚未快照的原票。修为夜初资格／版本＋normal阶段、全部活人票权先校验、在第一回调前取原票与PK inert快照。原红输入保留，原样独立复验 **16/0/38断言**，`/tmp/awa-animal-puffer-all-a-review-green.log`。

R对旧日死亡边界的实际运行已落在修后版本，独立 **2/0/7断言**，未冒称旧版红证据；首末轮／PK／自票／资源和被动期限读审通过。T/L/D确认Actor无新增调用／回执字段，保留真实来源／gateway／PM／录制未交付边界；实际目标完成与prepare先决约束另补复核。此foundation范围无剩余可复现P1/P2，不以此验收完整角色。

## 维护门禁

- 第一维护 **92/0/283**；第二 **94/1/296**：旧Cat维护直接开最终exile未记录／seal，补合法整轮全弃票，原失败日志保留。
- 第三 **98 pass / 0 fail / 305断言 / 6文件**，`/tmp/awa-animal-puffer-authority-maint-third.log`；含河豚21项、Cat17项及原Fox／原体／纯状态／有限配置。
- source/tests/frontend类型检查全部0，`/tmp/awa-animal-puffer-authority-types-third.log`；backend deps/boundaries/i18n全部0，`/tmp/awa-animal-puffer-authority-lint-third.log`。
- R `/tmp/awa-animal-puffer-authority-r-review.md`，A `/tmp/awa-animal-puffer-authority-a-review.md`，T `/tmp/awa-animal-puffer-authority-delivery-review.md`。

下一步接Fox/Bear许可策略、真实Night／Voting／DeathResolution／PM、共享事实和已告知投影、公开四组合／双语、录制Tape／本机SDK与ACP／观察种子／前端及全支持阶段验收。main功能小提交，不推送，不读真实认证／用户私有配置或调用外部模型。
