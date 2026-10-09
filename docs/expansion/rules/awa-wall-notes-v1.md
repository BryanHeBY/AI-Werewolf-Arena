# AWA匿名墙纸条：首组有限事件/道具

来源：出版社《The Werewolves of Millers Hollow: New Moon》英文规则书印刷10–11页的“The Writing’s on the Wall”变体。https://cdn.1j1ju.com/medias/35/c6/96-the-werewolves-of-millers-hollow-new-moon-rulebook.pdf 。原文要求天黑前在场玩家各写短句，主持人收齐再随机宣读，作者匿名。它是规则书变体，不是36张印刷事件卡之一；不能杜撰印刷卡文或称网易规则。

唯一首批事件ID `awa_wall_notes_v1`；唯一道具ID `anonymous_note`；板子须显式启用单包 `awa_wall_notes_once_v1`，默认关闭。该AWA改编只在第一日正常放逐投票流程完成/完整死亡链/最终判胜之后、第二夜开始前触发一次。如果第一日提前自爆/骑士结束白天，没有该正常时点则本局不触发（平票、全弃权、白痴免死只要正常投票完成且非终局仍触发）；已终局没有纸条请求。请求与提交使用日1 Voting+专用wall_notes阶段，完成后才递增日次；一次触发、离散工具输入、字符界限与失效处理为工程适配，不冒称出版社事件卡。

## 效果和资源

事件生效时冻结真实活人原生命、规则身份与阵营，给每人一份本人可用的命名纸条实例：source={kind:wall_event,eventId:awa_wall_notes_v1,day:1}, itemId=anonymous_note, remaining=1, expiry=当次墙窗口关闭。稳定ID/座位/名字、角色技能原库存、胜利归属、互认/狼聊/刀权均不变。纸条不参加夜伤/保护/反弹/死亡链，不授予任何技能。

每个冻结活人提交 `write_note {text:string}`，限定1–160 Unicode codepoints，纯空白或不良UTF-16拒绝；合法原文不trim、不规范化、不剥[God]前缀，首尾空格保留；允许本人自由文字；引擎不推测秘密、不替作者写字、不翻译用户文字。1人1个optional min0/max1引擎request，allow_fallback=false；已有Agent内合法上限/非法纠错次数沿用接收器，不再分发第二个引擎request。全部已启动provider Promise.allSettled完成后，如存在真正异常，以冻结ID升序第一份原异常抛出，不接受任何回包，统一过期；纯未选/非法返回不是provider异常。无异常且phase仍有效时，以冻结ID升序同步gateway合法接受；合法接受立即消耗该实例1次；非法/未返/接收前错误/原生命或身份撤权不消费。冻结作者不能二次提交，窗口token/actor/来源/库存/当日phase/原生命必须匹配；替换库存和跨世界/跨窗口不能借权。首批无复制、转移、交易或任意附加道具参数。

同一收集轮全部请求在任何回包处理前构造，只给本人实例和公共开始事实，没有他人作者/草稿/已提交数量。全部结束后终验：已接受而之后生命或身份失效的纸条不发表但不退库存；失效和拒绝不编造消息，不从幸存作者重试；phase撤权则本次取消不发表。provider抛错等待全部已启动请求结束后保留原异常，finally关闭并使全部未用纸条过期，不发布部分结果。所有剩余实例窗口结束过期，换角色/复活/后日不刷新；整局事件提交栅栏不因重新进流水线重抽。

正式窗口开始与grant之前就提交整局事件栅栏，异常/取消亦不重开。构造后与逐个provider发送前复验作者/窗口，失效者不发请求且不刷新库存。

合法仍授权纸条先按原始文本固定UTF-16词典顺序形成匿名多重集合（保留重复），再使用独立随机流 `wall_notes` 洗牌后一次性公共事件给 `texts:string[]`，不含作者编号、角色、阵营、实例ID、原顺序或原时间戳；文本相同允许，不能以去重泄露/丢失作者合法输入。玩家可以自报身份或写暗号，这属于玩家自由文字而非引擎提供作者关联。God专属投稿事实保留actor/source/文本、消费/失效与随机顺序供录制；实际决策/Tape保留真实动作，玩家投影禁止God投稿事实。终端/前端/视频共用严格事实reader与中英文标签；公共文本保持原文。零合法投稿也发布texts:[]完成事实；阶段仍有效的取消发布无秘密cancel事实，阶段关闭/真正异常不追加公共cancel。God只发布稳定结构事实：grant、accept、rejected、revoked、expire和最终rank；每个状态字段和受众由实现前严格schema冻结。实例remaining合法消费0、未消费1，closed时expired=true，DTO effectiveRemaining=0；过期不伪造已消费。

## 初批支持与判例

首批有限AWA组合为Wolf/Villager/Seer/Witch/Hunter/Guard/Idiot七基础角色，随后分别核验与已启用P8角色组合；未核验组合明确拒绝。配置/反向serialize、实例DTO/提示、动作接收/晚校验、God记录/严格Tape、旧公共档兼容和前端生命周期必须闭环后才称支持。

- 默认关闭：无draw、实例、请求、额外事件，旧玩法RNG路径不改变。
- 正常首日放逐后剩5活人：5份本人实例和请求，收齐后1个公共随机文本数组，再第二夜。
- 首日胜利/早结束白天：0请求，0新库存。
- 掉线/非法/空文本/超长/死人/晚复活/角色或实例撤权：不接受无权输入；phase变化无晚发表。
- 发表前某已付作者原生命失效：不发表其字条，不回补次数；其它合法纸条可发表且无作者关联。
- 任意交换其他作者的同文本集合与私有决策：公共发表完全相同，不能反推原座序；回包完成顺序也不改变公开字条，不获得演员配对或顺序线索。
- 所有请求、消费、过期、公开字条、第二夜及最终胜利严格Tape一致；中英机器事实与资源完全一致。

状态：有限功能已实现，最终离线门禁通过；仍待用户验收。它不声称通用事件系统、完整36卡或其它道具已交付。

## 事实和排序的精确补全

所有请求、异常选择、接受和重复文字God排序按冻结玩家ID升序，ID不等于座位。内部wall_id是窗口授权token，玩家DTO删除；item_instance_id是本人唯一实例ID（wall:1:玩家ID），不同于目录itemId=anonymous_note。个人撤权只省略本人，其余仍发表；整窗配置撤权且Voting仍当前则公共cancel；phase关闭/真正异常不追加公共cancel。

God item事实严格状态：granted=remaining1/expiredfalse/无text；accepted=0/false/合法原text；rejected=1/false/无text（不保存非法正文）；revoked=0或1/false/无text；expired=保留真实remaining/true/无text。最后rank只有已接受且终授权作者，0基连续rank，作者不重复；公共无这些行。

最终RNG返回后的工程门禁再次核验整窗和已排序作者；这一纯随机接缝发生撤权时整次取消（当前公共phase仍有效才发cancel），不发表部分结果，不退已消费库存。记录token和实例label为确定复现编号；真实工具权限另绑定factory原始request的World专属WeakMap capability，不序列化，不进入玩家DTO。两个同时活动世界不能拿另一世界request或capability借权。

玩家归档新写入的source_event_seq与event request_id采用本视角连续可见序号，不能以God全局序号间隙推算隐私事件行数；God原始事件序号仍在God录制保存。旧公共档的历史全局provenance继续可读，不改写旧事实。时间戳保持实际公开事件时间，不声称掩盖一般网络/处理耗时侧信道。库存写入被只读/访问器/冻结篡改时按撤权处理；关闭权限不依赖存储写入成功，保留原provider异常，仍合法的原实例仅expiry写入被冻结/只读时，过期DTO和checkpoint由已关闭的原权威状态投影；instanceId/source/remaining被篡改或访问器污染时直接省略DTO与checkpoint库存。
