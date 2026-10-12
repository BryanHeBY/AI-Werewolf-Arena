# P9d 寻香识命运行、独立录制与交付

当前正式52/64。两角色已通过[完整技术验收](p9-fragrant-pair-stage-acceptance.md)并登记implemented；本文件保留运行和交付切片，用户总体验收继续开放。main线性、本地提交、不推送；不读用户configs/认证，不调用计费模型。

## 唯一职责与有限规则

沿[规则卡](../rules/awa-fragrant-pair-seer-twelve-v1.md)限定原生十二人。独立native:pair_check实例拥有双目标历史、次数及最后行动日，不能复制、赠予或转移。Fragrant owner持原玩家Alive/Role/独立Camp、原能力与记录feed；原生命变更撤销请求。原施法者首次死亡不倒销本周期已付关系。

真实开夜先到期、固定命名流一次抽取、冻结刀权；player knowledge与实际触发分开。严格bind/pair及狼聊/刀不fallback，普通Guard/Witch/day行为兼容。CLI JSON往返共用exact preset；Hunter缺省仅可补awa_qualified_sources_v1，其它政策拒绝。计数及实际阵营在安装owner时再次校验。

七类事实共享policy、reader、受众及中英标签：选择、布尔查验、夜初通知只给本人；实际开夜、到期、全波实际死亡和实际牵连为God-only。后两类实际提交先入feed再进行可失败的required操作录制。全波mark→所有合格遗言→警徽→枪→追加波→一次PM判胜。全波事实不代替公开死亡、不能改变前端Alive。

失败CP由owner已提交JSON重建两角色私库，拒绝复读已撤权对象的getter/伪造库存。已公开放逐、枪、自爆仅在原feed同周期、准确阶段/窗口且原死亡已提交后更新已授权知情；外来/clone、历史、访问器与God事实不能授权使用。正常夜公告对自爆刀口的重叠只允许同夜一次公告。

## 独立账本与通信

归档ledger独立从原始seed与命名路径实现FNV/Mulberry一次抽取，从原始决定推导native刀/保护/药与实际死亡波、绑定期限和一次资源、知识、原生库存、公开顺序、投票/警徽、合法遗言机会、全体好人outcome。检查每个完整CP及成功/失败游标、每个必需机会、所有domain op正反关联；拒绝决定+事实+CP共同删除、伪造phase、future/pending、资源返还及未支持板的负存在。严格Tape实际执行PM核事件与CP。

wire oracle使用已通过独立parser的请求前缀；不调用生产状态/投影函数做预期。核初始/当前身份、魅影None或合法singleton、完整known JSON、原生pair历史/状态、SDK保留历史与连续suffix、ACP精确增量/实际schema、actor/ordinal全覆盖。schema拒绝与业务拒绝各经原turn更正后完整终局。所有服务/模型/进程是本机合成。

## 原审查问题与闭合

| 职责  | 原发现                                                                             | 处理与原样复验                                                                |
| ----- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| R     | 实际World缺全角色/阵营校验，普通狼聊/刀上层可fallback                              | 完整原生roster、两个请求strict标记；配置/库存10/0/73，原roster3/0             |
| A     | 枪波重复God记录；required record异常后漏已公布知情；失败snapshot/CP复读撤权对象    | 每真实波一次、已公布根严格授权、canonical JSON；原14/0/63，failed CP3/0/15    |
| R/A/T | request phase/开启机会、重复error/pending、pack audience共篡改、漏notice及双删bind | 原R8/0、T23/0/35；真实deadcaster/preVote5CP、Guard/Witch soft2CP均接受        |
| A     | 最终/失败CP低报、伪op元数据/notice/孤op                                            | cursor及op双向闭环，原22/0/37含真实失败Tape与旧板负存在                       |
| R     | 死Witch后夜flag误reset；campaign共享day_speech被误拒                               | 只活人reset；按实际原请求机会匹配公开发言；40观察完整局通过                   |
| T/L   | wire缺专属身份/状态/history/schema；界面共同oracle和DOM私密遮蔽不足                | 独立wire原20攻击；新增14独立frame/22042断言、private DOM caption/seek/masking |
| A     | 自爆根已公布的失败知情、重叠公告可重复利用                                         | 8/0/50 selfblast授权与recordthrow；同夜唯一公告原2/0/5，原提出者复验关闭      |

原失败与修复日志保留/tmp，未将原红例称通过。首轮SDK错误是fixture把魅影当无队友；首次ACP批次误在root cwd执行既有backend相对fixture。两轮浏览器共用服务器发生connection refused，随后CI=1独占服务/retries0通过18；unit早期原始序号与presentation索引混用、fixture错误期望私有档无公开胜负均修正。维护wire负例首次在beforeAll前捕获undefined，改惰性读取后21/0/22；更正测试最初错误统计ACP为SDK rejected map，修后4/0/3348。均有独立原始日志，不混算最终全门禁。

## 已执行切片证据与待完整冻结门禁

- core/config/record：151/0/755，14文件，`/tmp/awa-fragrant-core-config-record-freeze.log`；后续窄唯一公告/遗言机会修正纳入完整门禁。
- 正常五族×SDK/ACP/mixed×两语30局 + 四stage×missing/late×SDK/ACP×两语32失败局：31/0/11570，`/tmp/awa-fragrant-wire-all-transport-first.log`，实际wire已核。
- 新增七族：caster_gun/link_hunter/second_night/protected/badge/pre_election_overlap/pre_vote；SDK两语14完整局，ACP/mixed两语28完整局，后者14/0/7794。手写生死、公开原夜死及CP逐一断言。
- schema/domain更正同时覆盖两工具，SDK/ACP×两语8完整局，4/0/3348，`/tmp/awa-fragrant-reject-actual-third.log`。
- retained真实MCP：两新工具×两语，2200ms后实际提交拒绝、原ID对新回合拒绝、close后拒绝、库存/事实不变及sidecar退出；早版4/0/50，最后旧ID补项纳入完整门禁。32超时局只证明取消/回收，不冒称完成这个实际迟到提交检查。
- 20固定seed×两语40受限观察局，全部自然、零reject/fallback、逐局Tape；2/0/52，`/tmp/awa-fragrant-observed-fourth.log`。重复调试批次不增加唯一seed数。约1000seed/板为P10门槛。
- 10实际God replay、10末CP、40实际player views；unit50/0/1773及独立14/0/22042，全部私有事实无Alive effect。18项Chromium单worker/retries0，masked DOM最终窄重跑见`/tmp/awa-fragrant-front-chromium-masked-final.log`。
- 实际Remotion PNG `/tmp/awa-fragrant-god-trigger-zh.png`、`/tmp/awa-fragrant-private-pair-en.png`：1280×720目检通过，God触发尚无公开死亡、英文仅本人身份/aggregate bool，另外11席遮蔽。

首轮完整冻结门禁在types处退出2（两项Bun expect的readonly tuple静态类型），未启动后端suite；独立预期改为同值的数组副本，未弱化断言。原输入2310文件与日志在/tmp/awa-p9d-fragrant-candidate-full-first，保留失败及闭环；第二轮仍有一处多行readonly断言未替换，在types退出2；原输入闭环保留。精确修正后单独frontend tsc退出0，第三轮重新从头冻结。

第三轮2310输入同字节闭环，三个后端分片6532通过/2失败/1条件skip；两项为机械狼旧测试未补新角色的精确preset错误码分支，公共拒绝与实际拒绝均正确。只修两角色expected分支，生产行为未改；原完整文件通过，第四轮重新冻结六分片（按第三轮实测耗时分布），九资源文件仍串行。第三轮后续front/build/Chrome未启动，不能混报通过。

第四轮后端6589通过/0失败/1条件skip，491唯一文件各一次、893707断言；前端933通过/3失败，77文件、56952断言。三项都来自旧AST覆盖测试仅允许NobleSecretBodyPayloadMap，未识别本批FragrantPairPayloadMap父接口。新增精确父接口路径映射仍拒绝未知父契约，补新事件正存在断言；生产代码不变，原文件通过。第四轮2310输入闭环SHA1c0f2038f53a0292a7715ac948a95f27a4b0130d9d17d4d1418f429a0aae4c03，13项实际门禁中前12退出0、前端退出1，双端build与Chromium未启动；A独立失败审计保留，后续修复不混入原统计。第五轮仍从头冻结全支持范围。

第五轮四项静态门禁退出0，但验收驱动从六改十二分片时遗漏权重数组长度，在启动测试前IndexError退出；没有后端执行或产品失败。2310输入before/onexit仍同字节，SHA834aa9b0d7477a5b08c75e0057b18891a6335dec6c722c18bf83b57641aaec33。原驱动与日志保留，随后统一SHARD_COUNT并增加分片长度断言，第六轮重起；修复后前端936/0/57467及双端build预检不冒充最终轮结果。

第六轮十二并发导致主机负载与尾延迟：两个完整录制初始化触及Bun默认5秒hook期限，既有大型受限seed模拟随后触及各自显式180秒上限，并出现超时清目录后仍在运行的writer错误。该轮已控制终止，仅SIGTERM本任务驱动所属97子进程，驱动保留并收齐退出码/输入闭环，未触及未知进程；复查无所属进程继续运行。十二分片均为部分执行退出-15，没有全文件完成证据；九串行与后续门禁未执行，不计通过。2310输入SHA2d6ba91965798553d5a0b75040bba361e31afc8fe9580a79fb52f06794949541前后同字节。A合成hook探针确认外层--timeout 30000覆盖默认hook，显式50ms测试仍按原预算失败。第七轮恢复原已通过的六分片，CLI传30秒；真实setup单文件探针证实jest重设10秒，不以该参数宣称全跨文件hook实际30秒；九敏感串行命令、普通10秒/精确故障1秒/真迟到2200ms以及显式模拟180秒均不改。原失败原样留档，不以更宽外层预算宣称修复产品deadline。

第七轮全支持范围同输入冻结门禁及最终独立审计已通过，具体结果与原轮边界见[完整验收](p9-fragrant-pair-stage-acceptance.md)。编辑器、P9e、P9f余六项、P10长资源/公开ACP隔离及T6明确隔离配置/预算仍开放。本板不能将任意混搭、真实模型或用户最终验收计入完成。
