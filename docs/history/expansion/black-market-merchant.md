# P7：黑市商人实现步骤与资源所有权

规则以[AWA卡](../rules/awa-black-market-merchant-v1.md#black_market_merchant)为准。赠枪底座与完整角色已交付，当前23 verified/41 planned。下列职责边界保持；运行、双语、随机、失败Tape及三路复查证据见[完整验收](reviews/p7-black-market-merchant.md)。

## 1. 被动赠枪底座

建立独立死亡能力实例，包含稳定ID、kind、原source、disclosed、领取/实际armed时点、单枪库存、disabled/永久deathExpired；实际运行的owner/life/phase引用留在运行作用域，不写JSON或玩家DTO。它不属于NightAbility，不写入原Hunter/Aw/其他接收者原生state。

DeathResolution开枪许可除actor/tool/phase/day/nonce，还须绑定本次确切实例ID：native为无礼物ID，gift为自己的ID。网关、选择回答与真正消费均核同一授权；换实例ID、借另一库存或只持有permit ID均不能生效。现有SDK/ACP/MCP入口从当前请求获取instance context，不让模型以参数自行选另一资源。

原生Hook先返回并由DeathResolution实际提交目标死亡，关闭该次枪许可，再进入gift Hook及新许可；原枪null/blocked也关闭自己的许可。禁止在整个actor死亡Hook末尾才统一关闭，导致第二枪重开报already_open；也禁止在原提案真正提交前关闭使其失效。至少通过两个连续permit和上一ID迟到/跨库存的实测。

最多一位Black商人、礼物copy拒绝，因此本板一个actor最多一个Black赠枪实例，加其既有原枪。仍按实例ID处理，不能靠‘通常只有一个’省去授权。原生与礼物依次请求当前仍活目标，第一枪末Wolf/末神之后仍完成剩余库存与死亡链；PhaseManager最后judge。

实际首次死亡可进入pending shot，但此时不抢先disabled礼物枪。该死亡动作/禁枪/放弃完成后永久过期，不能复活或enable恢复；取消/owner撤换沿原body/phase验证，不能把旧选择提交给新owner。低层transfer只给另一存活Good，保原库存/窗口/时点与退休记录，pending gun不得转出。禁止copy礼物。

底座commit `5c41428` 未注册Black，用受控Good角色G02礼物做有意义判例及真正SDK/ACP/MCP授权、迟到/取消/严格失败记录与Tape，旧Hunter/WolfKing/Aw等原生枪另作回归，不把Wolf当作本板合法获赠方。NativeHunter、复制Hunter与Black赠枪的玩家协议沿player_shot/death_shot，God原生来源保留；原WolfKing及其它已冻结具名枪保持各自公开type，不扩大中立化范围。中英本人投影、提示和记录具名字段不能漏到未授权玩家。

## 2. 完整角色与延期主动礼物

按卡实现strict black_market_trade、choice/消耗/关闭、原life反噬提案与独立God结果。获赠本人不知道donor号码；稳定ID不编码donor，外层/state/source/event投影白名单。商人状态不持有即时success/camp/giftID/报告。

用现G02实例拥有check/单毒；具名早槽与nextNight激活policy，不挪动原Miracle当夜晚槽。全局actor-local同kind目标ledger服务原生/礼物两条路径，成功才记录，非法/skip不影响另一个库存，不读他人动作。原生state和礼物实例无重复资源/历史来源。

实际夜末只提交gun armed，不猜交易日已结束；active gift日次/关闭与source/life作用域分别所有。原生参数/profile maxCount、有限组合校验、ownObservation/受限机器人与中英工具/提示/事件/终端同步。

提供六人AWA缩编和十二人单枪改编例子，不冒社区双枪板或未约定角色。以独立人工完整场景核全部技能、skip/晚赠、狼人反噬无通知、双枪次序/死因、警徽/遗言/判胜、死亡与库存；实际SDK/ACP（注入MCP）/混合×两语、每板20seed与全部strict Tape、failure Tape、前端实际档/browser/双语PNG通过且三路最终0后，才登记verified。

## 3. P7整阶段验收

Black完成后核P7七项均交付与全已支持板子/角色回归、模型通路、双语/复盘前端、作用域/PID与记录。受影响功能证据不能冒全阶段或全backend release。按2026-10-09最新指令，更新P7状态及功能commit记录后收尾交接，本轮不继续P8–P10。64角色/22机制全矩阵、定时大样本、发布长局与T6保留为后续工作，见[交接](handoff-p7.md)。
