# 完整重构进度

当前目标：完成 [计划](plan.md) 的 P0–P9 / C01–C48（包括 C05a、条件 C18a、C33a）。本文件只有实际完成的切片才能标记完成；原玩法扩充的暂停状态保持在历史文档中。

| 阶段                   | 状态   | 当前工作与证据                                                                       |
| ---------------------- | ------ | ------------------------------------------------------------------------------------ |
| P0 基线与契约          | 已完成 | C01 `144f48b` 已提交；C02 `aba9347`；C03 `b56d282`；七样例、89行静态台账与三方向审查 |
| P1 依赖与共享契约      | 已完成 | C04–C09 数据/支持职责与 public consumer 闭合；零基础包循环，兼容桥按 C44 退出        |
| P2 测试、fixture、词典 | 进行中 | C14成套archive/C15完成；C11累计188单测/C12累计89场景进程，余mixed tests/support继续  |
| P3 状态与请求授权      | 进行中 | C16生产读取/C18传播/F02/C19完成；Seer/Fragrant试点，其余状态继续                     |
| P4 规则计划与生命周期  | 进行中 | C21阶段成员快照与opaque lazy完成；完整RulePlan/C22–C24继续                           |
| P5 效果、死亡与判胜    | 待执行 | C25–C29                                                                              |
| P6 能力、观察与展示    | 待执行 | C30–C36、C33a                                                                        |
| P7 记录与独立复现      | 待执行 | C37–C40                                                                              |
| P8 目录、命名与文档    | 待执行 | C41–C44                                                                              |
| P9 全仓收敛与验收      | 待执行 | C45–C48；同源固定输入、门禁零债务                                                    |

每个切片记录 commit、实现者、独立审查、命令 / 输入指纹及剩余风险。编译与发现范围在每笔提交保持有效。阶段跨越不代表跳过未完成的切片。

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
