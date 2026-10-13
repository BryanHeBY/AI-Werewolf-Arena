# 完整重构进度

当前目标：完成 [计划](plan.md) 的 P0–P9 / C01–C48（包括 C05a、条件 C18a、C33a）。本文件只有实际完成的切片才能标记完成；原玩法扩充的暂停状态保持在历史文档中。

| 阶段                   | 状态   | 当前工作与证据                                                                         |
| ---------------------- | ------ | -------------------------------------------------------------------------------------- |
| P0 基线与契约          | 已完成 | C01 `144f48b` 已提交；C02 `aba9347`；C03 `b56d282`；七样例、89行静态台账与三方向审查   |
| P1 依赖与共享契约      | 已完成 | C04–C09 数据/支持职责与 public consumer 闭合；零基础包循环，兼容桥按 C44 退出          |
| P2 测试、fixture、词典 | 进行中 | C14成套archive/C15及mixed/support职责已落；593来源、693目标、8112旧IDs；阶段验收待汇合 |
| P3 状态与请求授权      | 进行中 | C16读取/C18/F02/C19与opaque／旧状态门面退出已落；完整能力schema／codec继续             |
| P4 规则计划与生命周期  | 进行中 | RulePlan实际同引用消费、late计划与周期单位已落；C22–C24完整机制矩阵继续                |
| P5 效果、死亡与判胜    | 进行中 | C25/26真实毒来源、C27实际Wave/Receipt与提交、C28馥郁／动物边界已落；全效果/关系继续              |
| P6 能力、观察与展示    | 进行中 | C35第五包、C36三贡献/领域展示退出已落；F01补当前资格，C30–C34完整矩阵继续                      |
| P7 记录与独立复现      | 进行中 | C37完整checkpoint与16verifier装配、C38生命周期唯一owner已落；记录/版本完整验收继续                                                                                |
| P8 目录、命名与文档    | 待执行 | C41–C44                                                                                |
| P9 全仓收敛与验收      | 待执行 | C45–C48；同源固定输入、门禁零债务                                                      |

每个切片记录 commit、实现者、独立审查、命令 / 输入指纹及剩余风险。编译与发现范围在每笔提交保持有效。阶段跨越不代表跳过未完成的切片。

重门禁按用户要求在固定输入后台检查点或多个大阶段汇合后执行。机械迁移以实际输入程序、引用和有限类型／边界证据验收；实际行为修改运行对应必要用例。最终 P9 同源全量验收仍需完成，不逐笔重复整局、发现或浏览器。

## 切片记录

- C01：`144f48b`。完整公共 blob / 实际用例清单及 F01 / F02 反例；characterization 14 / 0、inventory 8 / 0、类型和格式 0；三方向独立审查，历史输入 before / after 与根执行文件 coverage 两处门槛缺口已修。
- C02：七个固定输入、两构建独立严格回放、差分全一致；工具信任负例与独立动态边界审查见 differential.md。未扩大到全角色验收。

- C05a：三既有包独立public-entry验证，源码browser ambient与Bun tests项目分开；根check/test、offline lock/install闭合。该独立准备切片先于仍在交叉修正的C04/C05门禁提交，契约生产消费接线继续等门禁完成。

- C04/C05：同一public AST/debt验证边界协同提交；33维护测试、15提出者原反例、tooling类型0。基线规则补全重新推导1779债务；严格最终门禁不允许任何余项。根check/lint实际先执行架构gate。

- C06：新game-contract与两具名桥、真实frontend stage consumer、sourceHash/lock/metadata同步；有限差分7组、16后端+3前端局部断言及必要类型通过。重门禁遵从用户要求合并大阶段后台执行。

- C10（首runner/前端清楚integration组）：默认unit+integration发现入口，三原program只加职责头，8旧ID/fixture字节不变；局部8/0。其余P2分类仍proposal，未宣称C11–C14全完成。

- C07-A：结果/查验/错误/死亡data迁唯一contract，runtime句柄与permits留domain且body1221byte相同；独立审查10身份项，局部10+33/0；新source自动进入精确指纹。

- C07-B：1513中立消息IDs封闭类型及MessageRef、两语exact type coverage和真实纯类型consumer；字典/42函数body不改，独立审查通过。header局部gate修完；不迁丢backend严格参数refine。

- C08共同inert-data准备：copier原1495字符逐字保持，depth3/default128/null-proto/错误码/原文不改；4测试0与独立review，Node零trap入口仍不同职责，未将facts全部迁完。

- C08首六facts组：三agent实现并交换审查；10 actual consumers只换public进口与职责头，non-import statements全部原byte。每组局部/必要类型，public subpaths legacy TS精确解析修好；其他17facts仍待迁。

- C09配置形状准备：Board、schema、Cupid DTO 与政策标识归纯契约；独立逐声明/正文核对无行为差异，包内7/0/45。有限板子支持算法与独立复现检查尚待各自迁移，未宣称 C09 完成。

- C08后八facts组：互审确认声明与解析保真；17真实consumer非import语句逐字保持。作者14+28/0，原Node feed5/0及前端118/0，必要类型与新文件头通过。尚余关系/初始化/道具及内嵌解析。

- C07工具/回合data：65 tools、82 stages 保留顺序和原类型；独立10迁移声明/7领域声明逐字核对，3包内public/type项通过。FE原3覆盖项改真实public阶段入口后通过；完整请求/事件仍待事实依赖闭合。

- C08关系/初始化/道具八组：原声明与数据默认模板迁纯包，作者24/0与独立3/0；原FE显示27/0/349。5实际consumer非import原样，必要类型通过；内嵌label解析与C44桥退出仍未完成。

- C09有限支持完整迁移：17生产谓词/独立17归档谓词，各自owner无回导；原dispatch拒绝顺序与Node入口保真。三方向审查，40 consumer/test及42 formatter正文相同，原focused138/0与必要类型通过；text17算法及出口删除，Scholar29旧ID迁后端默认发现。

- C07完整事件/请求：事实依赖闭合后迁11 event/3request声明与真实factory/recorder；独立逐字段/正文相同，4 public/type项与FE原3覆盖通过，contract及backend源码必要类型0。运行Provider/selection/WeakMap仍领域；C07数据边界完成，桥待C44。

- C08内嵌六组读取：浅descriptor与late outcome顺序保真，作者18+54/0、4965旧函数差分0；Root38独立输出/反射项0、第三方逐guard审查0。原36其它formatter与2ID数组不改；C08数据职责边界完成，兼容桥及C34全观察统一仍待后续。

- C11首69单测：`f8c1ac4`；943旧ID、68原正文与Demon31模块路径例外保真，独立审查通过，必要600文件类型0。C12首9场景/进程：`d7cefe9`；55旧ID、原矩阵/正文/进口目标保持，ACP原2case本机端口许可后通过，其它重局留大阶段。

- C15词典与扫描：12 owner/1513 keys/403参数定义，3026 literal及两語顺序/descriptor/types保持；三方向审查，scanner真实根/祖先软链漏洞修正，3原canary拒绝。formatter原4/0、必要类型与扫描局部通过，精确例外不放宽。

- C14清单前置：907原文件/48,294,509字节四方同SHA；258suites全pending，未知来源明确。8原局部与4具体反例通过，4项审查问题修正后5原输入独立复核；archive/adapter选择器有实际owner策略。成套物理迁移及原动态loader尚待后续。

- C11前端26组：25事实/投影归前端功能目录，17 Scholar纯reader项归contract；206旧IDs、全部正文/矩阵与50 resolvedimports保留，职责头审查误述修正。必要FE/contract类型0，未重复26suite；统一mapping现108files/1241IDs。

- C13首15支持模块：15 builder/driver/oracle实际归属与162consumer/229modulepaths闭环；独立177原程序/1660旧IDs保真，原3内存文件30/0与必要类型通过。fixture-bound2helper单独待source asset，未造桥；混合支持模块仍待拆。

- C11前端剩49：39实际SSR文件与事件/投影/数据按责任归属，2结构测试default入口闭合；962原IDs与21files/28URI基址保真，独立审查通过，结构原4/0/549与FE必要类型0。统一mapping157files/2203IDs，未重复49/Chromium。

- C16基础：11 typed组件映射/default slot约束，17World方法与全module typeerase原byte；独立验证真实错槽/两向RoleCamp及customextras、3运行项通过。backend源码0，9负例/10explicitunknown注入原JS保持后tests0；legacy只显式T、C44退出，全consumer/state迁移尚未完成。

- C13消费者职责头收口：145原程序/imports/fixture逐字保持，仅补真实139测试/preload与6记录driver职责；actual comment checker145/0，Root14跨层抽审及全部原文独立核对通过。未重复全量测试。

- C17预言家试点：原abilities slot/ref保留，具体owner接两普通writer；4新/0/31+9原selected/0/75，13声明/body/caller保真与Root独立accessor核对通过，整合source/tests类型0。recipient重复读取和Demon第三sealed writer明确保留，其余机制与codec贡献未冒称完成。

- C18请求传播：existing request WeakMap 接21成功owner绑定、3实际consumer去十项清单；13程序排除明确routing edits后的AST一致，两个独立agent源审与15职责头检查0。新5+原characterization14/0/155，backend源码/tests类型0；精确求值/部分写入及未绑定descriptor边界见request-alias-propagation.md。F02仍旧预期，复杂状态与commit ports继续。

- C18a条件修正：P0已证Noble七种恢复反例，单独改current失败闭原shared turn；七旧mutation保留输入而新终态expect单列，另2真实最早过期/3非法提案隔离。21局部/0/166、840文件focused类型0；未改stock/settlement/archives，未重新生成golden。旧预期固定e8de6dc可追溯，其他角色政策不合并。

- C19行动窗口/完成端口：ActionTurn与receipt迁唯一owner、SDK/ACP真实直连；Reproduction原唯一assert/defer改具名入口，原provider返回与domaincommit分离。15原class/program/identity/typeerase证据及Root两原class全文核对，9selected/0/60、source类型0；无第二订阅/等待/round时间戳修改。

- C14 source assets：3 executable ACP+2待迁helper、16actual consumers闭合；904 JSON原path/byte保持，Root固定Gitblob907摘要独立复核。v2原/现摘要与5源码/进口身份、actual JSON metadata/cohort验证接根check:fixtures；严格finite字段与support realm的原攻击输入修复，25heads/0、必要types/0、原4+新3focused/0，3真实initialize/EOF进程0模型。904 archives实体迁移另笔继续。

- C14第三审小修：同一frontend ancestor symlink反例先证scan遍历后coverage拒绝，再修fixtureRoots逐段lstat；原payload现先symlink_rejected，维护1/0且0真实archivecopy，独立5source/16imports/3入口再核0。未重复907 CLI/大套件。

- C16生产consumer收口：actual318固定slot/123src全部使用默认ComponentMap推导；108准确头+15旧头，Root修F01 production例外和PhaseManager proposal职责表述。作者与独立审246 emitted grammar相同（107raw/16仅wrap），123头/0与14跨层抽审、完整source类型0；无新casts、无测试/fixture或业务修改，public旧重载与测试特权留C44。

- C20 Fragrant原生pair切片：2真实creation/commit消费者迁owned typed slot，CP alias同ref、5写prefix及3helpers原文保持；4new/0/34+9oldselected/0/59，source/单newtest types0，14作者证明与独立source/coldimport审通过。原/现catalog55同序，原direct-profile TDZ同位保留待注册/出口收口，非新cycle；整合架构0新增失败。所有机制状态/生命周期矩阵未冒称已完成。

- C14 archive完整路径切片：904实体迁移原byte/oldgone均0漂移、256local精确subset、258stable suite；最终66TS+7activeMD+global闭合，Root Git907逐摘要核，独立66wholeprogram/原253God与112private范围0。17动态loader与CLI真实sample遗漏修复，66heads/0、62实际FE focusedtypes/0、原CLI3/0，actual loaders成功、PW原362/23 discovery保留。所有acceptance仍pending，未重复full/browser。

- C14命名小修：旧localized player role字符串经ASCII slug得到空后缀，改明确1-localized-role.player.json；Root原1179bytes逐字保持，仍字面狼人/缺locale，不推machineID。global/local/2实际reader及当前ledger同步，原legacyreader1/0/15，未重复全CLI。

- C21准备：existing夜间闭包/动态能力/排序完整算法迁rulesets真实owner，pipeline直连、旧入口named同class/singleton。两全程序/实际bindings/identity Root+独立0，source类型0，原7selected/0/138；无actorfreeze/IO/fixedpoint改写。immutable RulePlan、显式合法duplicate/replacement及未知冲突政策仍下一slice。

- C12后80真实场景：1009旧IDs、499relative modules+21目录/board scope literals、679targets保持，80head/0。Root逐actualGit与明确edit重放原全文核0，80 scopedtypes0；代表3文件/12cases仅skip加载，exit1非testpass。implicitindex真实TS5097修回原目录形式，未放宽tsconfig；统一mapping237files/3212IDs，全游戏后置。

- C11后119实际单元：1217旧IDs、686relative bindings与26位置锚点保持，whole program/标题/全部array矩阵逐字证据与119head均0漂移。只跑一次119file类型0；3代表文件38case skip-only发现非testpass。独立source/职责审查通过后提交；统一mapping356files/4429IDs，剩余237mixed tests与support继续。

- C21成员计划：原getStages虚方法一次、普通dense array冻结members/meta、foreign opaque保留lazy；独立原yield-throw/conditional-next红prefix修复，不通过文档排除。9new/0/63与必要source/newtest types0，旧9sourceproof/receiver/liveactors保真；原数组append old2/new1明列政策加强。完整RulePlan与duplicate/replacement/C22仍继续。

- C17基础角色数据/访问：14实际feature leaf、15types/28native accessors、13profile+ability真实consumer；十private槽同ref、四ability安装copy/选择保持。57源码保真项、30heads0，source types0，原catalog/Seer8/0/293；独立实际Git/顺序/导入审查后提交。writer/lifecycle/schema/CP贡献仍后续，C17/C20全机制未完成。

- C12真实Agent integration19：110旧IDs、140module bindings、1实际MCP argv路径保持同目标；唯一argv数组raw字节例外明确，其余标题/参数矩阵/wholeprogram精确保真。19head/0、一次finite types0、独立actualGit审查0；原HTTP单例sandbox EPERM红保留，Root同localhost case1/0/6。统一mapping375files/4539IDs，不重复完整transport/对局。

- C17 Knight消费写权：公开readonly同ref、window真实publicport、唯一赋值移具体featurecommand；原preflight/clock/事实/死亡顺序不变。3sourceproof/5heads0，新3prefix/0/15、原Knight+projection/newtest有限types0；无runtimefreeze/refund/CP修改，独立actualGit审查后提交。

- C22注册政策：same-handler sharing+Ghost4显式声明，distinct sameID与dynamic第二ID占用的两原输入保留并明确拒绝策略加强；其余compiler/getStages/C21opaque原样。15focused/0/87+原Ghost1/0/3、final有限types0、四heads/newdeps0，独立原Map/getter/spread/receiver probe0；完整tool/schema/actor与RulePlan仍未完成。

- C12独立seed模拟8：46旧IDs、53relative bindings与原完整seed/policy/i18n矩阵保持；Scholar实际40seed头修准确，Demon125seed来源保留。8heads/0、一次finite types0、独立actualGit/目标/body审查0；不重跑20/40/125 World批次。统一mapping383files/4585IDs，剩余100mixed/1847与110其它/1680继续。

- C23寻香具体night unit：原acquired/closed与opening/normal/abort归单机制owner，World/events委托每读、lazy RNG原位、requiredrecord仍enginecallback，finally顺序/paid前缀不变。5AST/4heads0、独立8源项/cold6同exports；新4/0/24+原N1knife1/0/6。固定Gitd3c6f1d+C23三src的667source isolatedtypes0，排除未提交C24 context候选且红harnesslog保留；全C23仍继续。

- C12 mixed首5→10：29旧IDs逐一唯一归属、25callbacks/3audit describes/forOf/6纯helper原文保持，32retained targets/10heads0。独立13省模块+484依赖图核无必需setup丢失，明确SDK等loadset减少非整import同序。9短reader/vector/0/77，C24真实接线finite23含本10通过、原4context红保留。mapping升级v2区分388source/393target/4614IDs，wholefile与selectedcases保真分别记录。

- C24资格首slice：mutable ability store退出两feature/actorenum，7真实stage接窄query、12context接保原world/day getter；双全体filter/recipient/paid/Fragrant不变。独立28file/24原程序与store14/Witch3 body0、六readonly输入写拒/output可写与cold8同exports/catalog55；新7/0/35+旧5/0/34+Scholar1/0/14、source/finite23 types0。审查发现数组readonly不保护库存元素已type-only修复、原/新六擦除同；其余C24/RulePlan/tool consistency未完成。

- C12/C10 native-config-cli：2原文件/16旧IDs实际职责迁移；同25组wholeprogram/104bindings/7anchors独立审，103modules+5location字符串实际变、2anchors原样。必要25finite types0与3短路径case/0/25共用证据，不按小组重复门禁；本组原inputs/正文/标题/矩阵保持。映射现390source/395target/4630IDs。

- C12/C10 native-filesystem：5原文件/10旧IDs实际职责迁移；同25组wholeprogram/104bindings/7anchors独立审，103modules+5location字符串实际变、2anchors原样。必要25finite types0与3短路径case/0/25共用证据，不按小组重复门禁；本组原inputs/正文/标题/矩阵保持。映射现395source/400target/4640IDs。

- C12/C10 architecture：2原文件/6旧IDs实际职责迁移；同25组wholeprogram/104bindings/7anchors独立审，103modules+5location字符串实际变、2anchors原样。必要25finite types0与3短路径case/0/25共用证据，不按小组重复门禁；本组原inputs/正文/标题/矩阵保持。映射现397source/402target/4646IDs。

- C12/C10 causal-scenario：16原文件/38旧IDs实际职责迁移；同25组wholeprogram/104bindings/7anchors独立审，103modules+5location字符串实际变、2anchors原样。必要25finite types0与3短路径case/0/25共用证据，不按小组重复门禁；本组原inputs/正文/标题/矩阵保持。映射现413source/418target/4684IDs。

- C23 Animal具体night unit：原begin→acquisition→fact/normal→closed/条件abort归owner，World/events每读委托、Animal→Fragrant→Noble finally不变，原authority/facts同bytes。4AST/4heads0、独立cold6与exportidentity同；新3/0/21+原Cat N1knife/election/expiry1/0/7、finite types0。原误用DTO字段测试红保留且只修literal native预期；全C23仍继续。

- C17白狼王消费写权：readonly同slot、window/prompt/commit真实publicport、原唯一false赋值归具体owner；无再查/退款/死亡修改。4原程序/6heads0、独立cold8/funcidentity同，新2prefix/0/10+原消费者finite types0；不混合枪/Demon sealed stock。

- C17隐狼/石像鬼继承事实写权：各readonly字段/各具体true命令，原lastwolf/camp/inspection资格与pub顺序不变；不合并当前刀权或学习资源。4wholebody/5heads0，独立cold8同exports，new4/0/18与旧消费者finite types0；同slot/ref、无退款/死亡/CP变。

- C17 Guard普通payload写权：native/recipient原两个lastTarget赋值归owner、readonly读字段、recipient取LHSstate再RHSid；原marks/claims/pub/use顺序不变、Demon sealed第三writer保留。3wholebody/5heads0、独立Git赋值3getter/error前缀/cold8同exports；new3/0/13与旧repeat/nightAbilities finite types0。

- C24狼刀目标：4实际feature公开bool/ID贡献+wolf组合owner，6calls/4consumer保原World/target求值及Mist→Noble(2Role)→alive→Evil→Nightmare(2Role)短路；旧targetleaf无consumer直接删。原terms/fullconsumer/imports/10heads0，new7/0/37+原Mistknife1/0/19、finite types0；独立cold正常3入口同success/direct2同原TDZ，harness删leaf红保留后精确恢复oldinput。全native/targets/RulePlan仍pending。

- 当前机制迁移台账：基线89rows/原hash不改，另current-only query owner，共90rows900cells42partial/858pending/0complete或N/A；具体C17–24交付子项注明真实owner/commit/doc，补Wall alias与Guard/Wolf实际parts。独立增量8parts/20committed pointers0，C08/C09等未登部分明确scope未全覆盖；禁止据pilot或静态presence标整格done。

- C17 Witch普通payload owner：reset/refresh/close/native heal&poison/recipient--六具体命令，原flag-before-day/ctxreceiver/LHSstate-before-RHS/不同付款语义保，marks/claims/use/pub原序。三whole token inverse/5heads0、独立2额外前缀/cold8同exports，new6/0/20+原secondturnpass1/0、finite types0；Demon与verifier账本独立，全部readonly/schema/CP仍pending。

- C24 Seer/Guard目标政策：两原predicate归实际feature公共port，四consumer同函数，旧两薄leaf删；原history/day短路与getter错序不变，Guard无新增final重查。七程序/七heads0，new4/0/13+原Seer fresh-after-await1/0/5、finite types0；独立原Git正文与cold10同success/exports。全targets/RulePlan仍继续。

- C12 unit：3原文件/3targets/29旧IDs实际职责归属；19→20总体126bindings/53callbacks/210IDs逐actualGit保真，18whole与1case split分别证明。独立审通过，finite20 types0、原4短case/0/62共用证据，无重复transport/full。 mapping现416source/421target/4713IDs。

- C12 FS-runtime-integration：3原文件/3targets/16旧IDs实际职责归属；19→20总体126bindings/53callbacks/210IDs逐actualGit保真，18whole与1case split分别证明。独立审通过，finite20 types0、原4短case/0/62共用证据，无重复transport/full。 mapping现419source/424target/4729IDs。

- C12 causal-failure：12原文件/12targets/152旧IDs实际职责归属；19→20总体126bindings/53callbacks/210IDs逐actualGit保真，18whole与1case split分别证明。独立审通过，finite20 types0、原4短case/0/62共用证据，无重复transport/full。 mapping现431source/436target/4881IDs。

- C12 inspection-split：1原文件/2targets/13旧IDs实际职责归属；19→20总体126bindings/53callbacks/210IDs逐actualGit保真，18whole与1case split分别证明。独立审通过，finite20 types0、原4短case/0/62共用证据，无重复transport/full。inspection两组loadset539→538/539、十unused声明删且无必需setup丢失，保原literal/matrix，原render oracle debt仍pending。 mapping现432source/438target/4894IDs。

- 固定Git02b3fe3后台整合检查点：后端6987pass/1skip/1fail，sole漏规则docs准备错；原4catalog补测0fail但原red保留，不记complete-input全套all-pass。FE1159/pkg182/真实Chromium362均0fail；after3113public SHA+原dependencybytes/links全保持，仅exact frontend.vite新增19ownedregular输出。结果见integration-checkpoints.md，tooling/后续提交/P9最终同源验收未宣完成。

- C12 knowledge-passive recorded games：6原文件/138旧IDs实际完整录制/复现场景迁移；20whole程序/24callbacks/70relative imports保真，Root独立actualGit全部语句/113完整import语法/同目标/522unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原literal survivor与scenario计划保持，支持模块oracle欠项不据迁移关闭。mapping现438source/444target/5032IDs。

- C12 skill-inheritance recorded games：6原文件/180旧IDs实际完整录制/复现场景迁移；20whole程序/24callbacks/70relative imports保真，Root独立actualGit全部语句/113完整import语法/同目标/522unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原literal survivor与scenario计划保持，支持模块oracle欠项不据迁移关闭。mapping现444source/450target/5212IDs。

- C12 relations-affiliation recorded games：4原文件/117旧IDs实际完整录制/复现场景迁移；20whole程序/24callbacks/70relative imports保真，Root独立actualGit全部语句/113完整import语法/同目标/522unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原literal survivor与scenario计划保持，支持模块oracle欠项不据迁移关闭。mapping现448source/454target/5329IDs。

- C12 native-actions-bilingual recorded games：4原文件/87旧IDs实际完整录制/复现场景迁移；20whole程序/24callbacks/70relative imports保真，Root独立actualGit全部语句/113完整import语法/同目标/522unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原literal survivor与scenario计划保持，支持模块oracle欠项不据迁移关闭。mapping现452source/458target/5416IDs。

- C23 Noble真实night handoff：unit持原acquired/transfer、原位置Symbol receiver交manager三site、early abort-only不提前config/World读；normal后abort仍由bodyResolved authority判断，原finally次序/returngetter失败前缀保。独立7whole source/authority/facts/damage逆映射0、cold8同exports、7heads0；new10unit/0/60+actualN1lategetter1/0/4+原managerN2two/0/12，finite4files types0。初fixture/potiondelivery省略红保留仅修test；内部ownSymbol反射新增明示，JSON/spread/Tape形状无新增字段。完整Noble矩阵仍partial。

- C12 identity-relationships causal recording：8原文件/225旧IDs实际完整录制/复现场景迁移；20whole程序/44callbacks/73relative imports保真，Root独立actualGit全部语句/105完整import语法/同目标/361unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原beforeAll与两top-level await保持全因果场景，不做会触发对局的发现；原literal/fixture字段保持，支持模块oracle欠项不据迁移关闭。mapping现460source/466target/5641IDs。

- C12 animal-recording causal recording：6原文件/44旧IDs实际完整录制/复现场景迁移；20whole程序/44callbacks/73relative imports保真，Root独立actualGit全部语句/105完整import语法/同目标/361unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原beforeAll与两top-level await保持全因果场景，不做会触发对局的发现；原literal/fixture字段保持，支持模块oracle欠项不据迁移关闭。mapping现466source/472target/5685IDs。

- C12 radiant-recording causal recording：4原文件/62旧IDs实际完整录制/复现场景迁移；20whole程序/44callbacks/73relative imports保真，Root独立actualGit全部语句/105完整import语法/同目标/361unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原beforeAll与两top-level await保持全因果场景，不做会触发对局的发现；原literal/fixture字段保持，支持模块oracle欠项不据迁移关闭。mapping现470source/476target/5747IDs。

- C12 mist-blast causal recording：2原文件/30旧IDs实际完整录制/复现场景迁移；20whole程序/44callbacks/73relative imports保真，Root独立actualGit全部语句/105完整import语法/同目标/361unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。原beforeAll与两top-level await保持全因果场景，不做会触发对局的发现；原literal/fixture字段保持，支持模块oracle欠项不据迁移关闭。mapping现472source/478target/5777IDs。

- C21执行来源：实际pipeline遍历entries并以原handler receiver执行，来源只由一次foreignpack spread后own slots与原Ghost set clone观测；私有per-return WeakMap无World/actor/currentPlan，opaque next仍在前次execute后。独立7源码逆向/原helpers0、5heads/newdeps0；new8+原6registration14/0/71、原真实lateGift1/0/2，finite types实际exit0。原规则闭包/getter/loop/排序不变，完整参数/tool/revision/winner RulePlan仍pending。

- Guard旧ActionReception fixture兼容：目标政策后续finite检查实际发现旧seed直接写readonly字段TS2540，明确test-only mutable cast保同stored-state赋值，production读视图不放宽/不改被测路径。整fixture原程序仅该类型映射逆向同，原权限/resource/constraints case通过；该编译红保留，Tool final有限检查继续。

- 当前机制台账追加四已commit子项：Witch普通payload、Seer/Guard目标port、Noble真实handoff；独立delta四cell/source/docs/ancestor pointers0，89baseline+1current-only共900cells，43partial857pending，0complete/N/A。基线SHA60f1eb79原bytes不变；provenance补独立三IteratorClose前缀与cold8同exports证据，未重门禁。

- C12 noble-recording prefix contracts：5原文件/62旧IDs实际完整录制/复现场景迁移；20whole程序/77recognized callbacks+1curried skipIf/92relative imports保真，Root独立actualGit全部语句/119完整import语法/同目标/297unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。18scenario/2integration按实际边界归属，原beforeAll/cache/独有计划键与opt-in条件保持且不作发现或pass声称；RedMoon派生oracle债务仍pending。mapping现477source/483target/5839IDs。

- C12 fragrant-recording-wire prefix contracts：2原文件/52旧IDs实际完整录制/复现场景迁移；20whole程序/77recognized callbacks+1curried skipIf/92relative imports保真，Root独立actualGit全部语句/119完整import语法/同目标/297unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。18scenario/2integration按实际边界归属，原beforeAll/cache/独有计划键与opt-in条件保持且不作发现或pass声称；RedMoon派生oracle债务仍pending。mapping现479source/485target/5891IDs。

- C12 mist-prefixes prefix contracts：7原文件/132旧IDs实际完整录制/复现场景迁移；20whole程序/77recognized callbacks+1curried skipIf/92relative imports保真，Root独立actualGit全部语句/119完整import语法/同目标/297unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。18scenario/2integration按实际边界归属，原beforeAll/cache/独有计划键与opt-in条件保持且不作发现或pass声称；RedMoon派生oracle债务仍pending。mapping现486source/492target/6023IDs。

- C12 runtime-domain-boundaries prefix contracts：6原文件/51旧IDs实际完整录制/复现场景迁移；20whole程序/77recognized callbacks+1curried skipIf/92relative imports保真，Root独立actualGit全部语句/119完整import语法/同目标/297unique IDs复核0；20heads0与一次finite20 types0，不跑games/full。18scenario/2integration按实际边界归属，原beforeAll/cache/独有计划键与opt-in条件保持且不作发现或pass声称；RedMoon派生oracle债务仍pending。mapping现492source/498target/6074IDs。

- C22真实工具兼容注册：constructor真实policy、同ref不读params/不同ref完整data同结构保lastRef/prose，已知结构冲突两原输入明确由lastwins改拒绝；opaque Proxy/accessor/inherited/cycle/budget保legacy lazy，full opaque一致性仍pending。原set-method→name一次→policy→set前缀、ActionReception全class/raw/cache/参数读取保；独立5源码/4heads0+cold8同exports，new9/0/45+原3/0/26、finalfinite0。Guard fixture TS2540独立60846ea6修，所有初types/harness红保留；65domain/3transport未合并，无CP/Tape变。

- C21实际支持/组牌owner：原完整buildRoleDeck入pure rulesets、bootstrap真实consume；原supportsWall/getCatalog refs+readonly metadata、重复queries/拒绝/extra/fixed原序，World/fork/shuffled/组件/authority初始化全旧程序。独立wholebody/wholebootstrap/refs/3heads0+cold6同exports，actual5bootstrap before/current trace/ref/error/RNG0diff；new8/0/56+原fixed1/0/3，finalfinite0。初类型与跨SF printer harness红保留仅修测试注解/harness，config/revision/CP/fullRulePlan仍pending。

- C12 demon-native-fault native causal contracts：2原文件/65旧IDs实际完整录制/复现场景迁移；13whole程序/78callbacks精确path span外/84relative imports+2URL保真，Root独立actualGit全部语句/91top-level imports+4实际dynamic imports/同目标/278unique IDs复核0；13heads0与一次finite13 types0，不跑games/full。四Demon constant动态import和两Mist URL仅同target rebase，其他callback/matrix/setup保持；无raw全callback字节同声称，未发现或执行对局。mapping现494source/500target/6139IDs。

- C12 reflection-mapping native causal contracts：3原文件/57旧IDs实际完整录制/复现场景迁移；13whole程序/78callbacks精确path span外/84relative imports+2URL保真，Root独立actualGit全部语句/91top-level imports+4实际dynamic imports/同目标/278unique IDs复核0；13heads0与一次finite13 types0，不跑games/full。四Demon constant动态import和两Mist URL仅同target rebase，其他callback/matrix/setup保持；无raw全callback字节同声称，未发现或执行对局。mapping现497source/503target/6196IDs。

- C12 mist-native native causal contracts：2原文件/28旧IDs实际完整录制/复现场景迁移；13whole程序/78callbacks精确path span外/84relative imports+2URL保真，Root独立actualGit全部语句/91top-level imports+4实际dynamic imports/同目标/278unique IDs复核0；13heads0与一次finite13 types0，不跑games/full。四Demon constant动态import和两Mist URL仅同target rebase，其他callback/matrix/setup保持；无raw全callback字节同声称，未发现或执行对局。mapping现499source/505target/6224IDs。

- C12 suppression-modifiers native causal contracts：4原文件/106旧IDs实际完整录制/复现场景迁移；13whole程序/78callbacks精确path span外/84relative imports+2URL保真，Root独立actualGit全部语句/91top-level imports+4实际dynamic imports/同目标/278unique IDs复核0；13heads0与一次finite13 types0，不跑games/full。四Demon constant动态import和两Mist URL仅同target rebase，其他callback/matrix/setup保持；无raw全callback字节同声称，未发现或执行对局。mapping现503source/509target/6330IDs。

- C12 noble-native native causal contracts：2原文件/22旧IDs实际完整录制/复现场景迁移；13whole程序/78callbacks精确path span外/84relative imports+2URL保真，Root独立actualGit全部语句/91top-level imports+4实际dynamic imports/同目标/278unique IDs复核0；13heads0与一次finite13 types0，不跑games/full。四Demon constant动态import和两Mist URL仅同target rebase，其他callback/matrix/setup保持；无raw全callback字节同声称，未发现或执行对局。mapping现505source/511target/6352IDs。

- C17普通history写owner：RoleInspection/Dreamer/Beauty三payload写与Grave单push归各existing state叶，原captured refs/locals与history→callee→factspread→result两读保；use/连续判断/关系/资格/去重/events原位。12whole inverses/8heads0、独立Git/两Grave getter失败prefix/cold12同结果，原4cases/0/43与finite4files类型0；direct Beauty/Grave旧TDZ同位保留。mutable types/schema/codec/facade仍pending，初data-head契约红保存仅补具体字段职责。

- C23 Radiant具体night unit：仅acquired收begin/committed close/finally abort；normal后原World→events getter仍执行，原frame.closed独自noop，关闭发布失败不重发。独立12actualGit/4heads0+cold8同exports/funcidentity，原6leaf bytes保持；new5/0/18+原借药1/0/5、finalfinite0。初testunion未收窄status TS2339红保留仅补type guard；seal/paid/库存/PhaseManager/归档不变，全Radiant矩阵仍partial。

- C12 mixed llm-action-provider-protocol：1原file→3targets/10旧IDs按实际unit/FS/HTTP/MCP/CLI分配；mixed4整体21callbacks=20raw+1授权Guard cast emitted全同、9helper(2URL例外)/69relative/31uniqueIDs保，独立原Git/完整setup/loadset82删unused模块0必需初始化丢失；finite9 types0，无测试/discovery。caseSplit与selected程序保真单列不称wholefile；mapping现506source/514target/6362IDs。

- C12 mixed bilingual-rejections：1原file→2targets/8旧IDs按实际unit/FS/HTTP/MCP/CLI分配；mixed4整体21callbacks=20raw+1授权Guard cast emitted全同、9helper(2URL例外)/69relative/31uniqueIDs保，独立原Git/完整setup/loadset82删unused模块0必需初始化丢失；finite9 types0，无测试/discovery。caseSplit与selected程序保真单列不称wholefile；mapping现507source/516target/6370IDs。

- C12 mixed bilingual-tool-protocol：1原file→2targets/8旧IDs按实际unit/FS/HTTP/MCP/CLI分配；mixed4整体21callbacks=20raw+1授权Guard cast emitted全同、9helper(2URL例外)/69relative/31uniqueIDs保，独立原Git/完整setup/loadset82删unused模块0必需初始化丢失；finite9 types0，无测试/discovery。caseSplit与selected程序保真单列不称wholefile；mapping现508source/518target/6378IDs。

- C12 mixed noble-secret-body-cli-review：1原file→2targets/5旧IDs按实际unit/FS/HTTP/MCP/CLI分配；mixed4整体21callbacks=20raw+1授权Guard cast emitted全同、9helper(2URL例外)/69relative/31uniqueIDs保，独立原Git/完整setup/loadset82删unused模块0必需初始化丢失；finite9 types0，无测试/discovery。caseSplit与selected程序保真单列不称wholefile；mapping现509source/520target/6383IDs。

- 当前台账补五已commit子项：四普通history owner与Radiant acquired lifecycle，独立actual ancestor/source/docs/remaining delta0，90rows900cells=44partial856pending/0complete/N/A，冻结基线60f1eb79原bytes保持；历史42/43统计不改为当前。其他写权/schema/codec/租借边界仍待完成，不把本笔作为P3/P4闭合。

- C12 mixed4b acp-action-provider：1原file→2targets/3旧IDs按实际层分配；mixed4b overall4→8/39IDs、14callbacks=12raw+2directory literal spans、4helper/43relative/8heads0、426unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现510source/522target/6386IDs。

- C12 mixed4b bilingual-audit-tasks：1原file→2targets/8旧IDs按实际层分配；mixed4b overall4→8/39IDs、14callbacks=12raw+2directory literal spans、4helper/43relative/8heads0、426unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现511source/524target/6394IDs。

- C12 mixed4b awakened-configuration：1原file→2targets/15旧IDs按实际层分配；mixed4b overall4→8/39IDs、14callbacks=12raw+2directory literal spans、4helper/43relative/8heads0、426unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现512source/526target/6409IDs。

- C12 mixed4b hybrid-configuration：1原file→2targets/13旧IDs按实际层分配；mixed4b overall4→8/39IDs、14callbacks=12raw+2directory literal spans、4helper/43relative/8heads0、426unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现513source/528target/6422IDs。

- C12 mixed5c player-agent-factory：1原file→2targets/7旧IDs按实际层分配；mixed5c overall5→10/97IDs、19callbacks=11raw+8path spans、7helper/55relative/10heads0、64unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现514source/530target/6429IDs。

- C12 mixed5c agent-log-flags：1原file→2targets/15旧IDs按实际层分配；mixed5c overall5→10/97IDs、19callbacks=11raw+8path spans、7helper/55relative/10heads0、64unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现515source/532target/6444IDs。

- C12 mixed5c mechanical-configuration：1原file→2targets/51旧IDs按实际层分配；mixed5c overall5→10/97IDs、19callbacks=11raw+8path spans、7helper/55relative/10heads0、64unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现516source/534target/6495IDs。

- C12 mixed5c merchant-configuration：1原file→2targets/12旧IDs按实际层分配；mixed5c overall5→10/97IDs、19callbacks=11raw+8path spans、7helper/55relative/10heads0、64unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现517source/536target/6507IDs。

- C12 mixed5c mirror-configuration：1原file→2targets/12旧IDs按实际层分配；mixed5c overall5→10/97IDs、19callbacks=11raw+8path spans、7helper/55relative/10heads0、64unused public modules删0必需setup丢失，独立actualGit/物理路径/语法/单一case分配审通过。原source WIP类型红保留，Root一次combined18有限项目actualexit0，不重复测试/HTTP/ACP/CLI/game。caseSplit/selectedprogram与loadset裁剪分开证明，不称wholefile/evalorder等价；mapping现518source/538target/6519IDs。

- C12 mixed4d board-definition：1原file→2targets/11旧IDs按实际unit/FS/CLI/scenario边界分配；overall4→10/45IDs、28callbacks26raw+2精确location、11helpers7raw+4publicanchors、60relative bindings/10heads0，Root独立actualGit/所有data arrays/setup/完整imports/单一ID owner通过。静态577unique unused public modules裁剪0added，Bun emitted graph单列；即时schema/metadata/local stores/nativecapture无必需hook、fixture loader或IO丢失，第三方initorder不宣等价。finite10 actualexit0，不跑tests/discovery/CLI/game；caseSplit/selected程序证明，不称wholefile。mapping现519source/540target/6530IDs。

- C12 mixed4d board-config-closure：1原file→2targets/18旧IDs按实际unit/FS/CLI/scenario边界分配；overall4→10/45IDs、28callbacks26raw+2精确location、11helpers7raw+4publicanchors、60relative bindings/10heads0，Root独立actualGit/所有data arrays/setup/完整imports/单一ID owner通过。静态577unique unused public modules裁剪0added，Bun emitted graph单列；即时schema/metadata/local stores/nativecapture无必需hook、fixture loader或IO丢失，第三方initorder不宣等价。finite10 actualexit0，不跑tests/discovery/CLI/game；caseSplit/selected程序证明，不称wholefile。mapping现520source/542target/6548IDs。

- C12 mixed4d fragrant-pair-seer-config-stock：1原file→3targets/7旧IDs按实际unit/FS/CLI/scenario边界分配；overall4→10/45IDs、28callbacks26raw+2精确location、11helpers7raw+4publicanchors、60relative bindings/10heads0，Root独立actualGit/所有data arrays/setup/完整imports/单一ID owner通过。静态577unique unused public modules裁剪0added，Bun emitted graph单列；即时schema/metadata/local stores/nativecapture无必需hook、fixture loader或IO丢失，第三方initorder不宣等价。finite10 actualexit0，不跑tests/discovery/CLI/game；caseSplit/selected程序证明，不称wholefile。mapping现521source/545target/6555IDs。

- C12 mixed4d runtime-display：1原file→3targets/9旧IDs按实际unit/FS/CLI/scenario边界分配；overall4→10/45IDs、28callbacks26raw+2精确location、11helpers7raw+4publicanchors、60relative bindings/10heads0，Root独立actualGit/所有data arrays/setup/完整imports/单一ID owner通过。静态577unique unused public modules裁剪0added，Bun emitted graph单列；即时schema/metadata/local stores/nativecapture无必需hook、fixture loader或IO丢失，第三方initorder不宣等价。finite10 actualexit0，不跑tests/discovery/CLI/game；caseSplit/selected程序证明，不称wholefile。mapping现522source/548target/6564IDs。

- C21不可变参数：72paths将World唯一owner实际接入bootstrap/角色初始化/PhaseManager/DeathResolution/Agent/simulation/Trace/cursor；caller不冻结，runtime不可隐式revision，readonly公开数据不授能力。独立31readonly+7core+28caller/29expr原位求值逆映射0、72heads0、12cold imports同exports；family-first同原Fragrant坏input恢复，getter/构造/context原反例均同input关闭，初红保留。8/0/40有限owner与reader、family1/0/6、finalzero1/0/7、原unused1/0/3、Root真实fixed-deal1/0/3各自候选收据分开；finalfinite99983实际closed0（补齐最后一changed维护文件）。schema2/严格source-lock未放宽，完整RulePlan/阶段/P9全量验收仍待；本批不重完整套件。详见owned-board-parameters.md及generated证据。

- 当前台账追加已commit参数owner cb2957ac：仅config state一格pending→partial，90rows/900cells现45partial855pending，0complete/N/A；独立数据/原input/真实writer证据随source提交，完整RulePlan与其他机制边界不关闭，冻结基线SHA保持。

- C12 mixed8e runtime-config：1原file→2targets/12旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现523source/550target/6576IDs。

- C12 mixed8e transport-failure-recording：1原file→4targets/8旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现524source/554target/6584IDs。

- C12 mixed8e initial-identity-deal：1原file→2targets/3旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现525source/556target/6587IDs。

- C12 mixed8e fragrant-pair-seer-lifecycle：1原file→2targets/5旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现526source/558target/6592IDs。

- C12 mixed8e fragrant-pair-seer-runtime：1原file→2targets/9旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现527source/560target/6601IDs。

- C12 mixed8e fragrant-pair-seer-information：1原file→2targets/5旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现528source/562target/6606IDs。

- C12 mixed8e noble-secret-body-prompt-review：1原file→2targets/6旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现529source/564target/6612IDs。

- C12 mixed8e demon-hunter-facts：1原file→2targets/11旧IDs实际分层；overall8→18/59IDs，44callbacks42raw+2仅3dynamic+1sameCLIpath，26helpers原raw、全部arrays/loops原raw、114relative/18heads0。Root与独立审actualGit/所有setup/原ID单一owner/路径及heads0；必要hook/fixtureloader不丢。原import pruning103=85whole+18partial，author590unique removed/0add，审查时593额外3仅并行C23真实新leaves，两个snapshot分开保。finite18 session7207实际closed0，不跑tests/discovery/game。caseSplit/selected程序保真，不宣wholefile或全importinitorder；mapping现530source/566target/6623IDs。

- C23 Mist具体night unit：原cleanup-transfer唯一owner，完整begin/unseal公告与较早business damage handoff分开、原较晚才移交清理。manager pending.abort→frameabort/World-day-current读取/normal后两finally原位；三族独立28源码检查、17原files byte同、公开7func identity/8cold/3中间候选依赖同，本族原real1/0/43+三族new12/0/38、finalfinite78345与scopedgate9048实际closed0。engine public ports接真实函数，初4条binding红保存且0新增依赖，61原债未清；其他Mist机制边界仍partial。

- C23 Time Consort具体night unit：cleanup-transfer原flag归feature唯一owner；priority50 begin仍stage、stock/exchange/damage/frame状态原bytes。manager条件/currentness与normal后inner+outer abort World读取、重复normal-close原error保；同原public query函数经ports，无新frame store。原realcycle1/0/5+三族new12/0/38，最终有限type78345/依赖9048均actual0，独立整源/17prefix/公开引用/cold/中间候选0；完整时妃资格/权限/效果/编码等仍partial。

- C23 Scholar/Mentor具体night unit：仅原cleanup-transfer状态及原manager终结port，priority50 begin、赠予库存/paid/frame算法原bytes；normal后abort仍由frame closed guard决定，不毒化nextnight，未完成close后abort仍原拒绝。原realcycle1/0/14+三族new12/0/38，finaltype78345/scoped9048 actual0，独立28源检查/17byte原文件/7fn身份/8cold/3逐功能候选闭合。最后11scope实际bytes同已审final；原4binding门禁红与harness误红保留，不改债务/fixture，无重runtime/fullsuite。完整师徒矩阵与其他C23机制仍partial。

- 当前台账追加三已commit C23生命周期owner：709dc222/73943cac/5a5d5b8d，精确3cell pending→partial、90rows900cells=48partial852pending/0complete/N/A；baseline原SHA保持，余机制矩阵和最终门禁仍待闭合。

- C12 mixed8f death-causes：1原file→2targets/20旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现531source/568target/6643IDs。

- C12 mixed8f death-chain：1原file→2targets/11旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现532source/570target/6654IDs。

- C12 mixed8f wolf-king：1原file→2targets/12旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现533source/572target/6666IDs。

- C12 mixed8f wolf-king-day-policy：1原file→2targets/28旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现534source/574target/6694IDs。

- C12 mixed8f wolf-knife-lifecycle：1原file→2targets/8旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现535source/576target/6702IDs。

- C12 mixed8f dreamer：1原file→2targets/30旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现536source/578target/6732IDs。

- C12 mixed8f cursed-fox：1原file→2targets/21旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现537source/580target/6753IDs。

- C12 mixed8f bear：1原file→2targets/36旧IDs实际unit/scenario边界；overall8→16/166IDs=103unit63scenario，76callbacks75raw+1两精确ImportType path、该callback完整JSbyte同；47helpers/全部arrays/loop/describe原raw、148bindings/16heads0。Root与第三向actualGit/原ID singleowner/实际World写权限路径及11removedmodules无必需hook/fixture/IO损失审0；pruning94=78whole16partial，0added。初finite16 actualexit2仅这两路径红保存，仅修后单target58868actualexit0，不误称初16通过，不重16/tests/discovery/game。caseSplit/selected程序保真，不称wholefile/initorder；mapping现538source/582target/6789IDs。

- C17 Seer真实deep-read边界：owner一份SeerReadState覆盖scalar/lastResult/history/row/result，get/set同ref只读不freeze/clone；AI经公开同binding ports、profile回owner，普通及recipient命令仅owner逐表达式擦除cast保原4writes/重复state-target/spread/push。7prod+2原fixture整runtime同、10heads0、14stage/codec/reader/independentledger原bytes同、12cold同exports；owner+新negative/live5/0/36、原promptfixture1/0/2，finite3607 actual0、scoped99677 actual0/0新债39旧债。初matcher类型红与head红保，仅test-only cast/具体头修，完整RoleRecord/可写能力出口/schema/codec仍待。

- C23 Magician/WolfSorcerer/Trickster真实耦合：单Magician transfer owner/frozen只读primitive query，两个dependent无第二flag；原单config晚读/3configured abort、stage80/100 begin、manager14site、Trickster finished保持Dayexile/outer无新abort。独立16Git source/2整engine逆映射/14原files byte同/11heads/10public bindings/18cold一致；old directprofile两TDZ仍原症保留非green。new10/0/31、bootstrap-first原3/0/25、actual必选失败prefix原EPERM后auto批准单localhostcase1/0/77；finite56188/scoped53511实际closed0，53原债未更。单一原规则耦合完整11path一功能提交，归档无callback/revision，other机制边界仍partial。

- 当前台账追加Seer已有state格deep-read子项f6c48778及三个原耦合lifecycle格9695d888：90rows900cells=51partial849pending/0complete/N/A，baseline60f1eb79原bytes保持；通用RoleRecord/可写能力句柄/codec/完整机制consumer验收未清空。

- C12 mixed10g phase-manager：1原file→2targets/8旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现539source/584target/6797IDs。

- C12 mixed10g sheriff-pipeline：1原file→2targets/6旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现540source/586target/6803IDs。

- C12 mixed10g night-wolf-tactical-loop：1原file→1targets/6旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现541source/587target/6809IDs。

- C12 mixed10g self-destruct-windows：1原file→2targets/29旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现542source/589target/6838IDs。

- C12 mixed10g black-market-merchant：1原file→2targets/22旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现543source/591target/6860IDs。

- C12 mixed10g hybrid：1原file→2targets/37旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现544source/593target/6897IDs。

- C12 mixed10g lucky-abilities：1原file→1targets/20旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现545source/594target/6917IDs。

- C12 mixed10g miracle-merchant：1原file→2targets/19旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现546source/596target/6936IDs。

- C12 mixed10g participation：1原file→1targets/16旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现547source/597target/6952IDs。

- C12 mixed10g public-death-policies：1原file→3targets/22旧IDs实际分层；overall10→18/185IDs=138unit46scenario1FS、78callback77raw+1exact samepublicJSON URL、64helper/class/table/loop原raw、190bindings/18heads0。RootactualGit全程序selected/setups/physical/原ID单一归属0，另两独立方向真实classification/loadset0；初Rootsetupwalker把原class当额外执行红保存，仅补已原raw验证的class声明识别。59unique removed/0add、pruning115=98whole17partial，无必需注册/World/provider/IO/hooks丢失，不宣完整外部initorder。finite18 session54671实际closed0、不tests/discovery/game重跑；caseSplit及三wholeowner在evidence分别登记，mapping现548source/600target/6974IDs。

- C12 mixed8h awakened-damage：1原file→2targets/31旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现549source/602target/7005IDs。

- C12 mixed8h gift-gun：1原file→2targets/39旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现550source/604target/7044IDs。

- C12 mixed8h gravekeeper：1原file→2targets/20旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现551source/606target/7064IDs。

- C12 mixed8h mirror-girl：1原file→1targets/18旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现552source/607target/7082IDs。

- C12 mixed8h psychic：1原file→2targets/24旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现553source/609target/7106IDs。

- C12 mixed8h knight：1原file→2targets/23旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现554source/611target/7129IDs。

- C12 mixed8h witch-correctness：1原file→2targets/8旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现555source/613target/7137IDs。

- C12 mixed8h witch-policies：1原file→2targets/22旧IDs实际分层；overall8→15/185IDs136unit49scene，83callback80raw+3仅5exactdynamicpaths，gift inline type path同原target未改，77helper/table/matrix/loop原raw、194bindings/15heads0。RootactualGit/full selectedprogram/physical/原ID singleowner0，独立真实bounded/full/setup/cachedcatalog/fileresource判读0；Psychic同cache额外factory读取显式记录，不称evalcount同。19unique removed0add、prune92=70whole22partial、必需preload/FS清理owner保持。finite15 session93504 actualclosed0，无tests/night/discovery重复；caseSplit及Mirrorwholeowner保持各自证明，mapping现556source/615target/7159IDs。

- C16/C17角色容器读取边界：23生产、63既有测试支持、1新unit；readonly privateState保同对象，init专用写契约保自定义键和原容器替换；20实际owner仅原具体槽擦除cast。原86运行程序保真，两路独立实际Git/87SHA审查闭合、37控制字节同、133测试造数cast反移后完整typed/runtime同；3新/0/22，完整src/tests compiler14063实际0、有限87头0/新dep0/原债3。原诊断与25可选尾逗号proof红保留并说明语法等价范围，newunit locale annotation单文件补核。没有重复对局/发现/full；普通可写能力句柄、全角色schema/codec及核心容器最终opaque仍待。详见role-private-container.md及generated/role-private-container-evidence.json。

- 角色容器台账登记：实际03cf07e8的原存储read/initowner新增current-only跟踪行；旧90row全部保持、freeze89 SHA未变，独立有限delta/source/committed-doc审查通过。现91rows910cells52partial858pending/0complete/N/A，只有新state为partial；全机制及各格验收不据此关闭。

- C13 inertLLM测试驱动：原helper归support/drivers/agents/llm-clients，七实consumer同步、旧入口删除；8完整typed程序只8模块literal和2责任头反移同，73旧IDs/所有矩阵正文保持，独立actualGit/唯一模块/每instance跨retry状态审green。有限8entry在实际8bd788da source/support/packages候选snapshot编译81662实际exit0，与并行source隔离，没重复tests/discovery/game。原badge缺head红保留并准确补mixed职责；其余support/fixture/oracle与badge分层未据此关闭。

- C12 mixed8i strict-provider-policy：1原file→3targets/23旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现557source/618target/7182IDs。

- C12 mixed8i gargoyle-inspection-and-inheritance：1原file→2targets/32旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现558source/620target/7214IDs。

- C12 mixed8i hidden-wolf-camp-policy：1原file→2targets/8旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现559source/622target/7222IDs。

- C12 mixed8i reproduction-persistence：1原file→2targets/5旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现560source/624target/7227IDs。

- C12 mixed8i victory-record-contract：1原file→2targets/17旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现561source/626target/7244IDs。

- C12 mixed8i historical-role-policies：1原file→2targets/25旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现562source/628target/7269IDs。

- C12 mixed8i i18n-source-scanner：1原file→2targets/2旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现563source/630target/7271IDs。

- C12 mixed8i role-catalog-contract：1原file→2targets/4旧IDs实际分层；overall8→17/116IDs54unit26integration36scene，56注册保含5postbaseline无P0ID。RootactualGit/full selectedprogram/原ID singleowner0，52callbackraw+4仅精确publicdoc/dynamic/inline type路径，28helper及数组/父loop原raw、167bindings137relative/17heads0；独立真实分类/setup/483unique omitted0add/77prune=61whole16partial闭合，两catalog额外warmread明示不称初始化计数等价。原62668因并行P3source/7fixture诊断exit2保留；exact46c source/support/packages/scripts/tooling+17原候选的finite10834实际exit0（初缺原night-stage-fixture的snapshot红保，补原Git输入）。没有改mutation输入/加cast或重tests/discovery/game，后续只读API自有一致fixture切片。mapping现564source/632target/7275IDs。

- C16/C17 whole七种夜间能力读边界：30生产、37旧test、1新unit；all/find/active/actor/native install/grant同ref只读，所有实际普通payload读参闭合，scalar readonly→mutable结构赋值漏的Witch参数与纯Shelter读参也收窄。原metadata/writer/3state读取onehistory/markers/checks顺序保持；完整77163actual0+最终68 finite52080actual0、新4/0/19，68head0/newdep0/原债14。Root及两独立实际Git/68SHA/67program+两command/25未动候选/11codec-verifier-controls审green；136窄fixturecasts+1同detachedinput+2matcher泛型反移typed/assignment树同，267注册不是展开IDs。初4syntax/draftproof与actor误采原文provenance红保，canonical trueGit35832实际0并补独立origin审闭合，无current源码改动。完整角色schema/codec/custom贡献/opaque容器/旧出口与后续生命周期继续待，不重games/full/discovery。

- 82fc0231台账：八个既有state格仅登记已交付read/write子项，三公共owner pending→partial、五payload原partial追加；独立有限delta/实际committed owner/doc/counts/旧91row逆还原和freeze89 SHA审green。现91rows910cells55partial855pending/0complete/N/A，完整矩阵及最终门禁仍待。

- C17夜间能力pureData唯一owner：21原声明归game-contract/night-ability-data，actual54path接线（30backend含删Seer纯typeleaf、21旧test、2contractsource、1compilecheck）；45actualnamed/inline类型consumer全publiccanonical，旧无consumer typeexports退出。21member AST/42双向赋型、29backend+21test+root51运行程序、删除/新增typeleaf惰性证明同；两独立真实Git/54SHA/23codec-sealed-player-verifier-controls审green。完整backend14063 actual0、browser source0、pkgtests20978actual0、最后runtime1557actual0、54scope33430actual0/新债0旧5；首declaration ExportSyntaxList与两head红保留仅harness/说明修。PrivateWitch terminal不进入playerDTO，自定义keys/Roleenum/optional-null/readonly接受保持，无Runtime World/lease/command迁包、无parser/新schema/模型或fullgame。其他55角色完整schema/codec、opaque容器、共同生命周期和旧value出口仍继续。

- C12 mixed4j scripted-standard-games：1原file→3targets/10旧IDs实际分层；overall4→10/68IDs15unit2integration51scene，31注册全保。RootactualGit/full selectedprogram/原ID singleowner0，31callback及15helper全部raw、原数组/父loop保，100bindings85relative/10heads0；独立真实分类/setup/473unique omitted0add/55prune=46whole9partial闭合。原runRecorded是latent函数，不增加eager factoryread；初工具text分类误报cache留存，修AST仅查真实顶层initializer。Badge直接hook不因constructor升scenario，Radiantunit明确原publicboard读取支持input，完整录制另scene；actual346b source/support/pkg/scripts/tooling+10finite34932实际exit0。没有mutation输入/cast/断言改动或tests/discovery/game重复，不称wholefile/import initorder等价。mapping现565source/635target/7285IDs。

- C12 mixed4j victory-membership-and-sealing：1原file→3targets/16旧IDs实际分层；overall4→10/68IDs15unit2integration51scene，31注册全保。RootactualGit/full selectedprogram/原ID singleowner0，31callback及15helper全部raw、原数组/父loop保，100bindings85relative/10heads0；独立真实分类/setup/473unique omitted0add/55prune=46whole9partial闭合。原runRecorded是latent函数，不增加eager factoryread；初工具text分类误报cache留存，修AST仅查真实顶层initializer。Badge直接hook不因constructor升scenario，Radiantunit明确原publicboard读取支持input，完整录制另scene；actual346b source/support/pkg/scripts/tooling+10finite34932实际exit0。没有mutation输入/cast/断言改动或tests/discovery/game重复，不称wholefile/import initorder等价。mapping现566source/638target/7301IDs。

- C12 mixed4j badge-choice-authority-and-deaths：1原file→2targets/38旧IDs实际分层；overall4→10/68IDs15unit2integration51scene，31注册全保。RootactualGit/full selectedprogram/原ID singleowner0，31callback及15helper全部raw、原数组/父loop保，100bindings85relative/10heads0；独立真实分类/setup/473unique omitted0add/55prune=46whole9partial闭合。原runRecorded是latent函数，不增加eager factoryread；初工具text分类误报cache留存，修AST仅查真实顶层initializer。Badge直接hook不因constructor升scenario，Radiantunit明确原publicboard读取支持input，完整录制另scene；actual346b source/support/pkg/scripts/tooling+10finite34932实际exit0。没有mutation输入/cast/断言改动或tests/discovery/game重复，不称wholefile/import initorder等价。mapping现567source/640target/7339IDs。

- C12 mixed4j radiant-wire-oracles：1原file→2targets/4旧IDs实际分层；overall4→10/68IDs15unit2integration51scene，31注册全保。RootactualGit/full selectedprogram/原ID singleowner0，31callback及15helper全部raw、原数组/父loop保，100bindings85relative/10heads0；独立真实分类/setup/473unique omitted0add/55prune=46whole9partial闭合。原runRecorded是latent函数，不增加eager factoryread；初工具text分类误报cache留存，修AST仅查真实顶层initializer。Badge直接hook不因constructor升scenario，Radiantunit明确原publicboard读取支持input，完整录制另scene；actual346b source/support/pkg/scripts/tooling+10finite34932实际exit0。没有mutation输入/cast/断言改动或tests/discovery/game重复，不称wholefile/import initorder等价。mapping现568source/642target/7343IDs。

- C12 mixed8k animal-dream-runtime：1原file→2targets/19旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现569source/644target/7362IDs。

- C12 mixed8k configured-role-policies：1原file→2targets/55旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现570source/646target/7417IDs。

- C12 mixed8k demon-hunter-runtime：1原file→2targets/50旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现571source/648target/7467IDs。

- C12 mixed8k demon-hunter-stock：1原file→2targets/23旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现572source/650target/7490IDs。

- C12 mixed8k ghost-bride-runtime：1原file→2targets/12旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现573source/652target/7502IDs。

- C12 mixed8k radiant-eclipse-cross-night：1原file→1targets/7旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现574source/653target/7509IDs。

- C12 mixed8k radiant-eclipse-domain-invalid：1原file→1targets/5旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现575source/654target/7514IDs。

- C12 mixed8k radiant-eclipse-runtime：1原file→2targets/34旧IDs实际分层；overall8→14/205IDs55unit150scene，77注册保。RootactualGit/full selectedprogram/原ID singleowner0，72callbackraw+5仅11runtimeDynamic/4inlineType精确同module路径，21helper及所有数组/父loop原raw，102top bindings及103actualrelative identities/14heads0；独立实际qualification/unit vs fullPhase/setup/checkpoint/失败scene与452unique omitted0add/63prune=46whole17partial审闭合，2原BoardParameters自身freeze不属必需hook或IO。原eager声明/实际factory无新增读取，未称完整external initorder。exactc65源码/support/pkg/scripts/tooling/原enginebuilders+14候选finite85684actualexit0，role14API旧造数cast归后续一致批；没input/断言/cast改或重复types/tests/discovery/game。mapping现576source/656target/7548IDs。

- C23 Demon/Wedding普通night交接：Root6source+1newunit实际7scope；Demon acquired仅begin成功后、Wedding owned失败仍cleanup，原late Wedding→Demon transfer和manager4无guard freshWorld close位保持，captured fact原getter/Date/spread/array序同。Root两engine完整registered-edit复核/两个openingbody token与两独立actualGit/7SHA/17原binding同refs/16recording-sealed-controls原bytes/隔离8cold入口全green。三Demon新case原许可绑定后pass、三Wedding相关最终3/0/32；新fixture初request/ownedconfig/chatdelivery错误保留，补真实原流程不改prodguard。exactc65+7candidate finite90120actual0、最终7scope7478actual0/新债0旧47，首typed/head/inverseharness红保留只具体修。无已付退款/新closeguard/通用cleanup、schema/statepolicy/阶段推进改动，不重fullgame/tests/discovery。

- C17 普通14族状态闭合：24原数据声明与20有限读取别名迁公共契约，14getter及真实捕获／策略／DeathShot读者只读，8具体owner命令保持原引用、访问顺序和已付失败前缀。55路径／23原test完整程序核对，源64 ESNext+CJS及命令body、声明AST绿；新4/0/15，源码51571与完整source/tests22972实际closed0，browser类型0、55scope80862实际0且head/新旧依赖失败0。原损坏fixture仅45具体字段／history适配加1安装DTO断言和1expect variance，输入/断言/运行保持。两独立方向最终SHA收口，不重全局门禁；schema/codec、自定义profile、opaque core与旧入口仍待完整迁移。详见ordinary-role-state-boundaries.md。

- C12 final-mixed agents-and-native-night-capabilities：7原文件→12目标/157旧IDs。完整17→37/564IDs/239原注册由Root actualGit程序核对与独立实际边界/setup/loadset审闭合；234callback和174helper原raw，其余仅精确路径。固定23511的869公开输入+37candidate finite96667实际closed0，首typeRoots红保留无源改。83unique omitted0added，Hidden同singleton暖读取1→2明确不称完全loadorder/evalcount同；原输入/断言/fixture保持。不重runtime/discovery/fullgate，C13 support继续。详见final-mixed-test-migration.md。

- C12 final-mixed identity-relations-and-public-events：10原文件→25目标/407旧IDs。完整17→37/564IDs/239原注册由Root actualGit程序核对与独立实际边界/setup/loadset审闭合；234callback和174helper原raw，其余仅精确路径。固定23511的869公开输入+37candidate finite96667实际closed0，首typeRoots红保留无源改。83unique omitted0added，Hidden同singleton暖读取1→2明确不称完全loadorder/evalcount同；原输入/断言/fixture保持。不重runtime/discovery/fullgate，C13 support继续。详见final-mixed-test-migration.md。

- C17 赠枪／转移枪状态边界：原DeathGun数据与deep source read view迁公共契约，all/find/active/grant/transfer/capture/firstDeath保持原Ref，arm/expiry/enable及2次shot付款归原owner。6路径、9原完整运行程序/DTO/单field命令体核对，Root实际源审+独立真实Git声明/3fixture wholebytes/6SHA绿。新3/0/20，source42413与完整source/tests90403实际closed0，首77041的3只读fixture诊断保留；scope98927 actual0/head/新旧依赖0。未重完整suite/game/discovery，剩余15role和opaque/schema/codec仍继续。见death-gun-state-boundary.md。

- C17 其余15族状态：31原数据声明+18有限read aliases归既有公共owner，14live getter原guard/ref、Scholar独立归一化copy输出保，33原字段write rights+9原test seed具体casts同位置。46scope、45完整程序/31decl/44先前data/62双向赋型绿；新3/0/17，fixed2cca finite78561 actualclosed0，Root多批汇合source9989 actual0，46heads0。Root实际DTO/新negative/ref/copy/accessor审和独立真实Git31members/33writer/9seed/46SHA审green，不重runtime/game/fullgate。opaque core/完整codec/facade继续。见remaining-role-state-boundaries.md。

- C24 五原生阶段策略／效果编排：30 frozenA source/test路径，失败/目标/已付effect必填ports，lazyWorld/day/target和原sealed动态loader保。7完整程序逆/9原拒绝链1168同输入/12ctx程序/8cold入口全绿；新5/0/17和原4阶段代表通过，source13059、scope90889 actual0/新债0旧25，最终fixed69+A30十四root/597input8945 actualclosed0。Root读3完整binder/真实Witch/原receipt/Alive与A-onlySHA，sharedpipelineee39 staged独立于B；P3两port误入scope已剔并保红，未重原源码证明。C24整体/RulePlan/伤亡业务继续。见native-night-policy-dispatch.md。

- C23 周期夜间接收方组合：16路径，ruleset owner按原pretry/12Unit/10scope/open/晚close-transfer/finally顺序，manager持原8Unit对象与Noble原结果receiver，options仅late thunk读。6normal分别currentness、freshWorld、重复inner/outer/noOuterTrickster保；完整2engine登记19edit+准确head/public routes与两独立操作/身份/constructor/SHA审green。新4/0/22、source9989及多批current全src/tests/scripts35862 actualclosed0；scope13931actual0/head新债0旧43，初新literal/hooks/head/reducedbinding红保且未加豁免。RulePlan/后续effect/death等仍执行，未重整局/globalgate。见cycle-night-lifecycle-composition.md。

- C13 整批support职责：58原文件→79owner+18既有=97TS，159decl单owner/157raw+2driver逆10原assertblocks；201consumer410bindings，97/176edges无cycle，原40initializer单归。fixed049 source280roots43571实际0，Rootcurrentsrc/tests/scripts35862 actual0；两独立真实角色/IO/init/classification审与2sourceassets6binding/C14 named-export反例修闭。RedMoon实际生产排演归driver/消费头准确，不称独立oracle；6准确head+目录/两route的7file后delta仅源码说明/路径，历史compileinput不重写。精确冻结338path+Rootgate/docs提交，工作区4opaque+随后facadeimports保留各批。无整局/发现/globalgate重复，阶段退出仍待验收。见support-responsibility-closure.md。

- C17 核心opaque容器：68路径，核心readonly object原对象/factory/descriptor不动，33源与34oldfixture完整程序证明0、39owner视图/3Mist读取/93fixture具体typeadapter，原init/指针/值/权限guard/cloneprecedence保。原29Git+4C13working+1A12明源，C13已6cff独立冻提交，opaque只加入已有新imports上typeviews。source99781 actual0、新3/0/11、68heads0；81183仅新RootB literalhooks诊断由B修，多批whole-src/tests/scripts35862 actualclosed0，Root实际API/retired/copyboundary及第二向真68SHA/13schema录制controls审green。不runtimeModel/globalgate重复；legacyfacade/全codec/后续phase继续。见opaque-role-container.md。

- C25 首效果折叠：原13条折叠语句归night-damage-plan，resolve真实一次消费12个只读字段；原结果分配/实体循环/mark清理及后续getter失败前缀保持。查询仅Alive只读/印记身份，6负例99692实际0；原72/0/169+新3/0/12，有限类型90660 actual0，四heads0。Root与独立真实Git源码/receiver/原四函数/三个边界审green；初类型root与inspection-forOf定位harness红保留，只修harness。完整EffectIntent因果时钟、deathwave/receipt/C26–29仍pending，不重复全gate。见night-damage-plan.md。

- C17/C44 状态门面退出：100真实consumer/102静态import+5dynamic/175binding直达原15owner，113paths含9实际port/3既有port+旧facade删除。100非importtyped程序0；beforedelete惰性175funcidentity0、完整src/tests/scripts2781实际closed0。Root实际源审+独立175准确站/27publicbinding/113SHA/112heads终审0；仅一preloaded mixed Promise.all微任务不同明确，四single仅route。13新／触及职责头中文化非头byte同，不重复compiler；Hunter缺项真红及重复dynamicmatcher红保留修正。全schema/codec/能力观察及其他C44继续。见role-state-facade-exit.md。

- 用户补充维护要求：重构不中断，新增与修改注释使用中文；触及文件顺带翻译职责头，在重要逻辑、数据结构、授权、排序和失败边界补准确说明，审查检查真实性。规范进入plan.md第16节，注释增量以程序保持／职责门禁验证，不重复行为测试。

- C26 单目标伤害政策：原23条目标语句归night-damage-target，resolver保持前置filter/结果append/finalclear；只读plan+四lateID/只读modifierlife+marks.has，唯一取消命令两remove同receiver/原branch。完整原token/cancelinverse/alloc/return与独立5SHA审绿；原75/0/181，新增两prefix后boundary5/0/20，88420/82764及5权限负例42845 actualclosed0。五相关文件头与重要逻辑改中文，原生命/单反射/晚查询/部分取消说明有效，runtimeerase保持、heads0，不重fullgate。完整来源贡献/死亡wave/receipt仍继续。见night-target-damage.md。

- C27 原生命提交owner：DeathCommitter唯一settledLives在原字段位置创建，原query1World/command15World+10events+11state均经准确deferredgetter，5实际site委托；原11member/ESNext+CJS inverse、default和付费失败prefix保持。10paths含7真实publicports、10原funcbindings；new3/0/21+原retry1/0/4，finite13055/12755与10head/newdeps16822 actual0；Root真实源审+独立10SHA/token/readorder/单账本/公开端点审0。中文重要结构/先付款/晚账本注释准确，初新8privateedge与两printer/mapmatcher红保，不重fullgate。TypedWave/Receipt及14旧resolver依赖继续。见death-commit-owner.md。

- C21–24 实际RulePlan：9paths/8源+1test，manager唯一plan复用原params，pipeline/bootstrap/recordwriter四消费同ref，native3factory/12unit/4checkpoint真实使用。标准默认首次late固定decl/membership/priority，变更/opaque转换明确拒revision（政策强化非机械等价）；7reservation不加entry，55合法潜能/lategift现场资格保。原callee getPlan先于World thunk由独立发现修3files/trace1/0/2；7actualGit输入、42未改body0与10registeredchangedbody源码审、两独立9SHA/ref/opaque/record审0。finite38790 actualclosed0、12不同case/0/36分四执行+原grant1/0/2+writerstrictreplay1/0/3、9中文heads0。不重fullgate；全RulePlan矩阵/后续phase仍partial。见execution-rule-plan.md。

- C28 馥郁死亡波发布：4paths，完整原record/publish归具体窄owner、5caller保；仅actorquery/late day-phase-events/publish命令，无World/库存/阶段写权。9原classmembers/ESNext+CJS inverse、4SHA/两method与params/实际publicRoot查询和facts→pub→requiredrecord顺序独立审0；中文heads/newdeps0，finite62003及scope70178 actual0。首new3green+1traceexpect红/旧2cancelgreen，补原phase读取后仅失败case1/0/10，不虚报重整套。结构receipt仅data/spy，真authorityprepare/commit/cancel保；TypedWave/Receipt/其他C28及13旧resolver依赖继续。见fragrant-wave-publication.md。

- C35 第五共享包实际消费：33原display函/918lines归4businessowner，40真实consumer110binding接canonical，旧text函数删无新桥；9texthelper/全部消息/原reader输出不改。54paths的完整typedfn(两Demon inline type精确route)/40nonimport程序及两精确fixture读取format尾逗号规则同，两个独立54SHA/110bound/puregraph/458oldlock/heads审0。pkg18322/后端23roots38017/wholeFE1447 actual0，包3/0/11+原FE6/0/28+原BE6/0/21；47中文head及20生产i18n0，scope37144新债0旧12。新FEcompiler定位自declareddep不放宽strict，初metadata/type/format harness红保，不install/model/fullgame/globaltest重复。更多presentation/profile/观察及C39/44/P9继续。见shared-presentation.md。

## 本轮提交收口

- `9a8337a8`：原生命死亡提交与唯一结算账本。
- `a483c416`：同一 RulePlan 的实际引擎／记录消费链。
- `d4c4ffcf`：馥郁双生死亡波事实、披露与记录所有权。
- `95ee2b56`：第五共享包 game-presentation 与全部现有展示函数双端消费。

四批均有精确源摘要、局部类型／必要用例和独立审查；中文职责与关键逻辑说明随各批落实。当前仍有并行 sourcedEffect 和动物死亡波准备候选，尚未列为交付。上述局部证据不替代 P9 同源固定输入全量验收，也不将仍待完成的机制格标为完成。

- C28 动物死亡波准备：4paths，完整prepareAnimal→feature窄owner/2realcaller，原World→unit与World→events→payload、cat过滤/事实/删源/到期/cause顺序保。wholetyped/ESNext+CJS inverse0、4SHA/source/权威/中文heads独立0；finite19277/scope52301 actual0，新4/0/21+原BeautyCat追加1/0/5(two boundedcycles)。首nullable/thunk/mock types红保，原位!无cache/default/契约放宽，不world写/rollback/全suite重复。TypedWave/Receipt/其他C28及13rawdeps继续。见animal-wave-preparation.md。

- C25 首来源intent：9paths，机械/Aw/原生Witch+DemonWitch10实际factory站和target/source/reflectionactor三实际消费，元数据复用原scope/day/ability，无新World/clock/RNG。原8Git/7完整module+机械fold精确逆及9SHA/中文head/source-paid-firstdeath独立0；属性锁+frozenorigin/double拒/每effect Symbol关闭两实际漏洞，legacy不读额外getter。finite50366 actual0，新6/0/24+integrity3/0/9+Symbol毒链1/0/8，原机械2/5/Aw1/7/Witch1/9/Demoncycle1/6通过。新协议约束强化明列非全等价，Meta不archive/schema/golden；Recipient/Scholar生产退出与全C25因果链继续。见sourced-night-intents.md。

- C33a/F01 默认生产观察回退：43源/test，SDK/ACP及factory退出Baseline，可信投影后仅detached/frozen DTO，64行动handler+report_bug明确null；fixednext0不推进RNG，六席隐camp控制新2/2旧3/2为独立策略变化。35旧test仅接口名逆+中文说明，34非ctor与strict/deadline/close控制保；新7/0/19+原19/0/59、有限66544/3API负例44967实际closed0，43heads/两独立43SHA审0。初fixture/stage新test红保无golden改，完整C33/34/C36/C44/P9仍待。见production-observation-fallback.md。

- C25 受赠/学者原毒与实际因果路由：6paths/5source+1test，最后两内建legacy producer退出、六内建push均factory；direct/reflected接受时保Symbolcause/原body/独立目标，target真实消费，同一plan hiddenroutes、legacy集合OR兼容保。新5/0/28+Proxy新增1/0/2；原Lucky/Black/Scholar3/0/29；finite75396与最终42403实际closed0，6中文heads/实际Git精确逆/独立6SHA和2SHA增量审0。legacyProxy额外Symbol读取由自审发现修为identity品牌，旧绿保留未重；无schema/board/RNG变更，全Wave/Receipt继续。见recipient-scholar-poison-routes.md。

- 当前死亡/夜间生命周期中文说明：12既有源，只改注释，补原体版本/死因资格、波次seen与账本区别、关系前置闭包、枪逐目标前缀、specificterminal/晚交接、两目标/因果Symbol、route OR及4实际规则卡链接。真实审查发现版本数字归档、取消抛错等过宽说明已收窄；完整AST12/0、职责头12/0、独立最终12SHA/4措辞delta审0，不重types/runtime/full。见generated/death-lifecycle-chinese-comment-evidence.json；不据注释称结构收口。

- C25/C27 真实毒接受证据：5paths，callback仅原Poison接受点，direct原旗标/反射cause独立，系统同结果hidden证据及Mist原freshcopy按最终死因过滤；无extraWorld/RNG/legacySymbolget/可枚举字段变更。新5/0/25+原Mist/plan25/0/117、finite12174实际closed0、3完整程序registered metadata逆/5中文heads/两独立5SHA审0。metadata非权限，fullWave/Receipt消费者后续闭合，未重复fullgate。见damage-poison-evidence.md。

- C30 赠枪生命周期owner：4paths，原owners/counters唯一迁life叶及16真实声明、原投影/type归playerState、entry保2真实copy/gateway政策和sameFn出口；无newloop/二store/genericgun。20声明/原player whole runtime同、15publicnames、new3/0/27+原bounded3/0/25、finite55450由实现者实际closed0，4中文heads/Root实际源审/独立4SHA与player两comment单SHA审0。原体、安装/武装/transfer/firstdeath/expiry重要逻辑就地中文；C30普通metadata/C31/C32继续。见death-gun-lifecycle-owner.md。

- 八已提交功能台账汇合：只登记9a8337/a483/d4c/95ee/157/7d63/dfd7/1099的53具体parts/51格；91rows910cells及freeze89 SHA、旧parts/remaining全文同序保，追加51条具体未完说明，现109partial801pending/0complete/N/A。Root独立真commit/owner/doc/12links与前缀/计数审0，首remaining完全相等的过强检查已改明确append规则，未改候选。中文注释不算结构交付，新d323/99fac已提交但本次未登记，fullWave/普通夜metadata真WIP不登记；不重tests/types/games。见current-delivery-ledger.md及generated/current-delivery-ledger-evidence.json。

- C30 普通夜实例metadata写权：37paths/19生产+17原test/support+1new，3完整原生安装/start/use归既有changes、34consumer/41binding同原名alias接线，旧query3出口清零无桥、Pair原pure函数仅canonicalexport，无反向环/新store。36actualGit whole程序及3decl/Pair原body同、37中文heads/SHA独立0；4精确intent调用末comma current21/orig3窄规范化说明及首红保，无arrays/fields/values屏蔽。新3/0/15+原安装transfer2/0/12/Pair1/0/3/WitchLucky1/0/8，finite24087由实现者actualclosed0，首Bun matcher type-only泛型修无输入/预期变动；Root实际职责/权限/时序审绿，不重fullgate。其余borrowlease/clock/具体payload与C30完整矩阵仍续，见night-instance-metadata-owner.md。

- C27/28 实际typedWave→CommitReceipt：5paths，initial/逐proposal真实unit共享及revisit原身份、2真正mark站传同ids/source引用、原ledger.set位置同对象version保、接受Poison匹配锁origin原体/版本进entry；PM三夜分支真实carrier、callback/枪/公开关联不改事件。data-only badtail预拒、新plan一致性和第三callback参/receipt返回明列政策；legacy同名getters+customMap.get两实际finding修own-data/nativeMap诊断。new7+old3为10/0/68、变route2/0/18、原paid/stale3/0/11、真实链增量1/0/16、兼容增量2/0/27，各自收据不冒最后整套；finite87022/58522/58007/末predicateleaf11470作者actualclosed0。3原程序6inverse/属性read37/123/238同、中文5heads/Root和两独立final5SHA审0；首config/testtype/proof红保。全effect/time/relation/record/P9继续，见typed-death-wave.md。

- C31 PhaseRevision唯一owner：原单值/2原++/3捕获3比较全部实接，samephase debug+1/noClose，新phase debug+2/state先写/close先event保；新3/0/14+有限23269Rootactualclosed0、完整manager逆/3中文heads/两独立3SHA源审0。首3newtest红为误忽略bootstrap初Nightday1事实，手写payload修无prod改；manager Night候选随后接同file，用已审phase精确blob暂存不覆盖工作树，Night/Exile/完整C31继续。见phase-revision-owner.md。

- C37 完整checkpoint形成链：7paths，5业务叶与固定assembly实际替原capture；authority/preflight→四setup→schema/cursor→原failure→Demon/Animal/关系/通用player整个表达式保原clone/ref/lookup序和schema2键序，无新registry/worldstore/规则重推/动态topIO。真Git927 whole源inline ES/CJS/整players/原bindings同、7CNheads/SHA和Root实际源/独立直接AST审0；control15whole+Noble2函数同明确。新Audit首1/4+fixture修后3/0/13、原2/0/8、finite42285作者actualclosed0、cold old/new same3exports；首fixture/fingerprint harness红保，不重games/fullgate。全rolecodec/verifierAssembly/记录生命周期继续，见checkpoint-contributions.md。

- C31 真实Night单位/到期消费：8paths，setup/current后prepare真实attempt独立id（非day+1），Noble open同authorityNight元数据/结果交接/manager原夜末expiry真正consume；brand仅identity，同对象nonenumerable，旧resultProxy/receiver getter无新增读取，原numeric期限/snapshot字段保。2actual审finding修 authoritycallee→World→day thunks、ownedunit.day preOwner匹配，新onlytypedunit拒列policy非全等价。新首3/0/16、合法pipeline单修1/0/6、callee/day相关3/0/14；原6/0/31+1/0/5、finite72501/76257Rootactualclosed0，首58456 A-WIPimport/newfixture工具shape红保。6全程序metadata宏逆/8中文heads/Root两独立8SHA/真Gitmgr069其余927审0；Exile/Wave关联/完整C31继续，见night-unit-ownership.md。

- C28/C32 狼美人具体触发receipt：5paths/4source+1unit，relation完整permit/nativehunter→claim→lazyDream actualkind claimed/blocked→原真实mark后commit/applied.kind发布，hook仍未领取proposal，blocked/保护throw保resolved不退款。唯一bindingsMap/原2boolwrites同位置，read-only Role/Alive/flags type边界，opaqueSymbol/identityWeakSet无二store/新死亡授权；所有实际旧commit consumer清零，newAPI拒clone/blocked明列。首new6/0/33+原边界2/0/10/原Hunter同波onecycle1/0/6，最后actualapplied消费者只补1/0/7、finite19510作者closed0，first59185覆盖前字节单列；4wholeinverse/5中文heads/Root实际源+独立5SHA/5oldfuncraw审0。首heads/formatter/permitcomment harness红保不prod适配，完整其他关系/C28/C32继续，见beauty-trigger-receipts.md。

- C31 全板Exile/Wave执行上下文：6paths，Voting门禁后一次开unit/7postopen返回含PK/王子/null/翻牌/映射复用；Animal id同原token/原authority+state全bytes保、不复制count，2真实自爆后skip，Knight无Exile。经理10真正resolve入口Night/Exile/原capturedrevision→existinginitial/additional/shared/revisit，context非per-targetcause/原origins保；ownData/Proxy新字段安全，Knightnullproto闭继承getter。新7/0/28+prototype增量1/0/1+原PK3/0/33，finite34646/36557/末19264Rootactualclosed0，首enum fixture/harness dual匹配红保；4wholeprogramme metadata逆/6中文heads/Root和两独立6SHA源审0，RedMoon/Knight两缺入口及注释finding全修。整机制C31矩阵/P9仍需汇合，见exile-unit-and-wave-context.md。

- C17 Pair完整state族贡献：4paths/3source+1unit，slot同原factory/schema/uniqueappend/JSONcodec/6aliases+后位data失效contract，authority真正安装/commit/2snapshot消费；native/pairState同Ref、state→JSON→use→abilityJSON→lease原前缀及parse方法→lazy字段保，无二store/普通payload重检/schema2变。新5+oldslot4实际9/0/63、finite2966作者closed0、3whole源ES/CJS精确逆/原moduleedges/4中文heads及Root实际source/独立4SHA/13datafuncraw审0。只Pair完整族，54剩余/自由扩展state/schema与C17整体继续，见pair-state-slot-contract.md。

- C37 独立verifier完整装配：24paths，原版本/schema先准入后16显式调用，3完整算法归独立owner，贵族audit同引用/恶魔RedMoon子链和第一拒绝保；18枚举helper真正退出重barrel，Magician传递依赖审查finding修闭。19真Git/3声明raw/完整main ES+CJS逆和24SHA中文头0，运行图136模块313边禁层/unknown0；新4/0/9+原Animal有界3/0/3，有限2829与helper28711作者actualclosed0，Root实际源及第三向两阶段审0。metadata只观察首次读取，非完整entrytrace，第三向未重图/type/runtime。全55语义/目录迁移/C39/P7仍续，内部英文注释下一批翻译，见verifier-contributions.md。

- 已触及审计逻辑中文注释：d0d2基线24checked/18changed，52原英文片段译中文并补2具体数据契约说明；RecordedEvent audience及Lonely后续决定条件两原过强说明审修闭。完整tokens/AST/ES+CJS原输出同、6未改wholebytes/18实际SHA与独立完整源码措辞审0；作者SourceFile.text与第三向scope字段两harness初红保，仅修证明不源改，不重types/runtime。技术字段保持，全仓随重构继续，注释不算结构交付，见verifier-chinese-comments.md。

- C38 录制生命周期唯一owner：5paths/3source+2newtest，6真实状态、timer/queue/firstMemoMeta移具体life并actual消费者接线，manager保dirty/store/mandatory账本和完整发布；原一个persist async/首failedPromise/closing只joinqueue/前缀完成后closed先finalIO保。新4+原mandatory4实际8/0/29、finite12471Rootactualclosed0，环境换清空/tmp日志如实记toolhistory不重、不造；另原ALS有界1/0/2，完整mgr ES+CJS精确逆/6正文/context/5CN头0。Root及两独立5SHA/2真Git/actual时序失败正文审0，markClosed打印/第三向原表读取两harness首红保而不源改。原closing可开trace/后段optional短路范围保，不据owner提取称全C38/P7完成，见session-recording-lifecycle.md。

- C34 全事件家族投影owner：4paths，全reader/受众/三白名单/字段裁剪真归同owner，feed保完整Node同副本/seq、direct boolean保原引用/弱接受，custom plainreceiver/晚Demon query/sourcecallee→两supplier保。11全程序展开/22canonical helpers真Git/4SHA+中文头与Root/独立全源新7字面审0；feed ES+CJS raw同，registry仅timeconsort两条件折行raw=false明确而完整tokens/AST同。初11/0/56和增量1/0/3分别、finite44355作者actualclosed0，原typeRoots/gettervoid/proof白名单与折行harness红保，不重旧cases/fullgate。仍原重复reader次数，无cache/新统一schema政策，C33/C36/wire/完整C34继续，见agent-event-projection-owner.md。

- C30 借用metadata唯一写权：3paths，安装本已shared不添wrapper，唯一disabled descriptor移既有changes实际command，原Frame guards/closed/status/suppression尝试/付款/事实保；supplier保nativecallee→原borrowed读取，无id重查/source改名/事件/二store。新3/0/15+原bounded5/0/13(14filter)，有限29847作者actualclosed0，2完整ES+CJS单call逆/真Git/moduleedges/3CN头及Root/独立3SHA全源审0。关闭抑制不保证恢复的一原过强中文审修闭，commentonly不重；新test noindex退出1正常差异不冒0。具体lease/其它C30继续，见borrowed-ability-metadata-owner.md。

- C33 全结构观察捕获owner：20paths(16consumer+删旧AI leaf+2gameowner+newunit)，全部ownState/身份/知识名单/team/history/能力/枪/3id裁剪及末clone-freeze实际迁，29world与role/team supplier原点保；16consumer canonical、公开type直同owner，无leaf桥。原19+new3首22/0/80，newfixture两个id/hooks合法type修后仅new3/0/23；strict33541作者真terminal0，旧tests不重。21完整程序/DTO/route/19CN头0，policy仅knownalive链折行rawfalse而全ES/CJS AST同/其余15raw同，具体call/signature/export末comma证明精修，不mask数组/字段。Root+两独立final20SHA及全部body/type审0，已知存活非真实alive，自定义文案及目标许可时点仍原，完整C33/C36继续，见player-observation-capture-owner.md。

- C29 完整终局候选验证owner：3paths，outcome/winner/reason/Victory members/point整算法归具体leaf，经理保fault/wedding/必要链/checkpoints/唯一终态/phase/event；两个world晚读及末day/原RHS reason保，无新store/规则判断。新3+原forged1实际4/0/11(6filter)，finite24504仅newmatcher enum type红，用expect<unknown>保字面JS后62499Root真terminal0。全validation AST/完整经理ES+CJS单delegate逆raw/3CN头与Root+两独立final3SHA/真Git审0；无关全file formatter扩Exile布局退原byte、模板/JSDoc proof红保只修harness。snapshot/fault/event原错置浅copy中文修真实clone，commentdelta不重type/runtime；全C29链矩阵继续，见validated-victory-owner.md。

- 已声明外部包别名边界：d94干净checkpoint真实78879 exit1、3062文件/6新增/598余债/1181清除，完整report固定保存而非后续工作树；5源精准same-name单路径自有declared external判定修两FE误报+fixture unit头，保公开目标优先/无installed读取，Root发现保留AWA未知namespace绕过已负例修闭。工具首39/0/74、仅namespace增量1/0/3、FE实际4/0/549，有限49441/20736作者actualclosed0；5CN heads/两actualalias图0，Root实际Git精确去新branch/3test后5整程序raw同、独立第三向5SHA源审0。三旧tests全tokens同，不改fixture/config/debtbaseline，不重fullgate；死亡3新增由独立批继续，见declared-external-alias-boundary.md。

- C33/C36 机制玩家字段裁剪：5paths，RedMoon五字段/Nightmare完整原indexed history/EvilKnight三字段实际归各stateowner，capture只同点组装、末clone-freeze保；不World新读/新defaults/状态或反射写权。首new3+原8实际11/0/96，新opaque fixture按原具名状态+Object.assign合法类型后仅new3/0/16、finite29276Rootactualclosed0；7完整运行逆/5CN heads/Root实际源+两独立5SHA/真Git字段与拒绝前缀审0。原getter/内部state算法同，私密知识注释称玩家可见不误称public；未重旧tests/wholegate，全部publicquery/native展示及C33/C36继续。见feature-player-state-projections.md。

- C28/C32 完整死亡feature贡献：8paths，Animal既有death-wave拥有真实runtime装配+全部初河豚/整波和追加事实，Wild原整函数mandatory原点登记EventRegistry而不强加旧duck HookRegistry新method/替换接口，Noble删除真实死import。mark→Wild→dream→遗言→lateHook/World-events-unit晚读/失败前缀保，fromRuntime避Function.bind遮蔽，无二state/新死亡账本。newAnimal最终3/0/10+Wild真实resolver1/0/10；旧Preparation4首mixedrun逐项pass但新fixture红如实不冒整轮绿、finite62412作者actualclosed0。10完整source逆/8CN heads及Root全diff+2new完整case/独立8SHA真Git9检查审0；第三逆harness锚错早同名local已仅修证明、6270tokens同，无重suite/gate。d94三engine新增实际owner修闭但全死亡贡献矩阵及P9仍待，见death-feature-contributions.md；固定checkpoint独立全文/digest核对见generated/architecture-checkpoint-d94b482c-review.json。

- Gateway具体机制公开边界：2toolsrc，新增gateway-feature对value/importtype都只允contracts/ports，避免AI预检迁移逃分类；原27a三gateway实际imports无具体feature，1779baseline不改。新literal双图实际1/0/2(36filtered)，严格有限自然exit0无live句柄，精确去一newif/一test的全ES+CJS2程序raw同；Root源审/独立2SHA/实际基线3imports审0，中文分支说明真实消费边界。未重fullgate/旧suite，也不把publicpath当权限验收；ActionReception完整owner另批继续，见gateway-feature-boundary.md。

- C36完整55原生展示+完整行动预检coherent迁移：213源码/test/package(170native+60preflight/伙伴-17重叠，1旧AIleaf删)，55真实读取/47运行装配及128typed即时片段归gamecapture→purepresentation，Role仅3data字段/游戏创建与WeakMap默认locale绑定，所有84factory/显示及39预检test/2装配+3约束消费者canonical接线；21scope/toolreader sameFn公开绑定，独立47/55/helper/Catalog/48query及12owner/6consumer/39完整test/49路由审0。普通profile callback保Proxy/copy/prototype及custom双get/this/lateWorld，明确C44 compatibility/eagerload未清；Role render写属性退休frozen/setter旧失败→新绑定差异/1keys断言授权API变更分列，不冒全初始化失败等价。历史110两语0diff/12(102)/copy2(4)/preflight18(156)、4746与57495真实0只toolhistory归属，环境/tmp日志丢失不重造；本次delta2/0/6+只API重写2/0/6，有限12244/99011作者actualclosed0，首typeRoots配置红保。170中文heads、Root17旧ports实序恢复与10comment ES/CJS同，窄port类型契约非runtime隔离的一头精修独立全token/2emit/60SHA同；两方向终SHA/Root213实际union及文档SHA审0。全3facet/余5domain方法/C44/整体矩阵/P9仍待，无全门禁/整局/模型/黄金改写。见native-presentation-and-preflight.md。

- a6e62126固定结构检查及端口说明修正：真实Git3083files/574violations/23new/551remaining/1228cleared，实际61355 exit1；12ports逐项补23具体输入/时点/权限/失败说明及约束文件尾空行。13全token和无注释ES/CJS同、heads0；独立实际源码/13SHA/完整报告/doc审通过，Lonely关闭无当前性检查和Magician原重复close措辞finding修闭。未重type/runtime/full；固定证据见architecture-checkpoint-a6e62126.md，不将检查红报为整体通过。

- C17 Animal完整三族状态贡献：4source/test，完整capture/currentness/原槽唯一replace与factory/schema/5纯转换/JSONcodec真实归state-slot，authority安装、付款、11读取/5提交编码接线；原引用/JSONparse callee→getter/写前缀保。作者12完整program和独立实际Git9check/4SHA绿，Root三方面owner/规则/API审通过；首7中6绿+仅decoder修fixture后1/0，最终合并244roots27644 actual0，未重原6/games/full。其他52族继续，见animal-state-slot.md。

- C36真实三贡献及剩余5领域展示退出：244 source union(117组件+56facet+84consumer含交集)，55metadata/runtime/presentation真实登记、47完整producer逆0、47冷profile全55/capturecache空、类明确组合根装配；域renderPrompt/Status.locale退休、customflat原ref/双getter/this/lateWorld保，静态字段分组求值差异明列。90组件consumer directsame+13同期facet逆，Root84完整program/import和另一方向权限/receiver审0；最终244backend roots=240本批+Animal4，27644 actual0，head248=本批244+Animal4全0；newgetter/Bunmatcher初红与纯type修保。有限facet22/3971、组件各delta/旧localization2/32、Root70中66绿4红，真Git a6同4fallback红已characterize不删assert，下一F01独立修复。17生产query/25fixture/5factory及wholeScope/SHA、Root三方面和文档终SHA审通过；其余阶段/全量矩阵继续，见role-contributions-and-components.md。

- F01当前自身狼队资格独立行为修复：8paths，mandatory DTO两bool由游戏capture在原字段后晚读当前自身政策，回调后同Role/ref/roleId/camp/Alive核对；无权限原因/对手realAlive/World/lease句柄，历史knownAlive保。SDK/ACP原4红断言现4/0/8，新6unique最终31assert（首5/27+改RNG/新callback差量2/11），无RNG/fork抽取；complete4原程序精确增量逆/3oldfixture literal与C44typearg归属、4archive/events控制bytes同、8CNheads及Root/独立8SHA/source/doc终审绿，finite9roots35267 actual0，首44344 stage新fixture红及同时C44采样红保。禁strict fallback/其它handler/提交lease仍原owner，不称机械等价；完整C33/P9继续，见fallback-current-wolf-actions.md。

- 两笔已提交角色/动物职责登记：1313149e与bccbc17c真实98parts追加，47profile text/内建展示oldExports各一项、Catalog2格+Animal state/checkpoint2格；91rows910cells，现181partial729pending/0complete0NA。冻结89基线60f1...原bytes，旧所有parts/remaining完整prefix、其余812cells whole同，actual ancestors/owners/docs独立910格审0。已注明AST漏节点及2fixture输入恢复的审查补核另commit；台账不等于全程序通过/F01与C44后续不在两来源part。本笔无runtime/types/gate，见current-role-delivery-ledger.md。

- 已提交源码审查证明纠正及2fixture恢复：原forEachChild push返回truthy漏节点，旧C36/Animal完整AST claim不得沿用；真正void全遍历3非首child canary旧误等价新全拒。fixed131 84全12.3万AST/two完整parser输出82同+2真custom fixture来源回归（不mask），Root恢复同fixture contributions，Night2语2/0/16+权限2语2/0/34；零匹配误pattern两receipt不计pass。fixedbcc Animal9完整/4whole ES+CJS raw同，组件5data/5renderer+90直接/13Root覆盖，无余未核；修candidate两输出经具体API逆+仅尾逗号token归一同，raw/typedAST false明列。暂存精确原4T与working双wholeJS raw同，C44类型退休另batch，未覆工作树。Root/独立walker/counter/source/候选/MDJSON SHA审通过，完整验收继续，见source-proof-correction.md。

- C16/C44 World旧任意T接口退出：866实际World调用/239file，864T移238consumer，2旧T保编译拒绝，11slot同；10unknown writes(9bad+1Identity)/10any reads原input同，仅10file必要!／precise类型强转保JS。241freeze/原source真实/两whole emit238raw同+3F01或Root行为恢复差异明列，World完整output同；有限241roots81820 actual0，原14unit/81assert，102原English heads译中文并补生命周期。Root真实World/权限/API审＋两独立241SHA/866 symbol/negative/原Getterbadinput审绿；World真实clock措辞finding修单commentdelta全outputs同；下一C17的2policy测试route用精确frozenblob隔离index，workspace保后续变更。仅旧T入口关闭，不冒全C44/P9，见world-slot-api-exit.md。

- C17身份查验6native/5policy实际状态槽与闭环：18paths(17现+删state)，全get/set、copy→既有policy、2append保3次state读、运行identity JSONcallee-first及3payload失效归slot；生命/source/id/激活/完整lease仍night owner。Root先发现ports库存写权假说明/两新增cycle，不提交首10candidate，扩为prepared-native完整35行实际write/revision/conflict/meta/source+2realcallee；abilities旧policyexport删，9prod+2test真binding canonical/publicports，21局部runtime图两指定反向path为空。完整强37checks含14全outputs及11importer22非import同/其它binding同，原8/0/91+只安装delta2/0/12，finite56492/35323 actual0；首重复backend测试路径loader红修删真来源保，无新strictpayload/归档shape/lease/规则。17CNheads、Root实际get/write/copy/授权边界+两独立18SHA/source/doc终审绿；其余族和全C17/P9继续，见role-inspection-state-slot.md。

- 9265335a固定结构检查：真实Git3095公开blob，后台14676 actual0，0new/537余债/1242clear；baseline1779保持，不增豁免。独立3095bytes/源digest131236f8...、537+1242 exactdisjoint partition及完整report/doc SHA审0，首ls-tree格式tool命令错误仅修工具参数不称产品红；只依赖/命名/职责gate，不是fulltypes/tests/浏览器/复现或P9完成。见architecture-checkpoint-9265335a.md。

- C38完整ReproductionTrace因果owner：20paths/4production+16tests/support，3完整decl从schema叶实迁无回导，原metadata+7可变载体/2cursorgetter/open pending→notify try外/clone→assert→defer回调结算/return可pending/同步notify失败catch再++与终建invalid先pending再parse全部保。真Git926/3decl+30完整schema+17consumer两emit/静态binding+1dynamicroute0，Root全Class与Node安全及独立20SHA/784+31+293nodes源审、doc终SHA绿；原15在首与混合两次执行均15/35，new6独立26首遗漏checkpoint全红与名字1case红保，后5/20+仅最后1/6＝21unique61assert，finite20roots13383 actual0/first54019纯!type红保。中文head/失败顺序精修，不称await settlement、资源付款或fullC38/C39；strict v2/source/lock/RNG保持，见reproduction-trace-owner.md。

- C17普通Seer/Guard/Witch三族完整slot：26paths(23现+删3旧state)，all旧get/set/普通与recipient写、generic3kind create和policyJSON3真实caller归各slot，prepared同库存metadataowner，profiles仅import，Demon封存完全原路。samecopyFn create/schema仅原JSON集合、不新增strictpayload；Seer recipient4state2id/Guard LHS先target/Witch两reset旗标先日期及native-=vsrecipientpostfix各保，scope完整life/source/id/lease仍原。104完整检查19whole13529nodes/38emits作者34raw+4tokenOnly、独立36raw+2tokenOnly真方法/22原Git/19binding/26SHA审绿，27局部图3指定反向空不称全仓。new8/0/46、finite23roots2639actual0后仅3专属中文head刷新不重；Rootactual全3slot/consumer与两独立source/doc终SHA已核。其它族/全C17归档schema矩阵继续，见ordinary-night-state-slots.md。

- 四族wolf knife继承真实共同检查点：5paths，PM初装与DR已追加标死/必要关系后发布前actual同步dispatch，RulePlan只注册组合、4机制fn仍原owner；WED/WED/WDE/WDE callee/每次roster/首error止与前prefix全部保，不新await/actorcache/RNG/lease。整PM7340+DR5128+Plan803=13271强node与6whole逆raw同、4calleeAST同，new3/0/10、finite5roots62300actual0；Rootactual5source/new3prefix与独立fiveGit/SHA/3方面+MDJSON终审通过，中文原getter序/uniqueownership限界就地；不把组合入口当整继承本体迁rulesets或55矩阵已完。见wolf-knife-inheritance-checkpoint.md。

- C13 夜间阶段构造器归属：实际30原文件／29调用方，旧 engine/night_stage_fixture.ts 删除，完整 helper 移至 support/builders/night-stage-context.ts。39精确模块路径修改，getter原this／闭包与末尾spread／默认构造时点、机器异常串及全部assert保持；60完整逆向运行输出相同，finite30roots14738实际exit0，30职责头无诊断。独立真实Git／51996节点／绑定和目标解析／35合并SHA审通过，不重测试或全量门禁。见night-stage-context-builder.md。

- 中文维护说明随实现继续：五Agent源仅注释，补真实创建与可取消等待／迟到回收／关闭去重／历史窗口与失败前缀／数据accepted≠commit／工具包装与授权边界。5真实Git原文／完整typedAST／10wholeemit相同，5职责头无诊断；两处独立措辞finding已修，35合并独立SHA及doc终摘要核准，不重type/runtime/globalgate。首scanner模板假差异及自动词项诊断如实保留，不因注释声称架构清零。见agent-chinese-comment-contracts.md。
