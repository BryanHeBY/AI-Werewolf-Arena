# 授权整改实施记录（逐项复核与新源码验收）

上一批功能源码：`095499186eff4748a46ef2f18d0834d5cb36f969`，原目录 `/home/hby/dev/AI-Werewolf-Arena` 的 `main`。基线 `eb4f026a38205d420cc2172b32fe23a29cb00da0`。`14f9e3c`修正Seer默认，`e9e7fac`补原生死亡枪及三角色查验策略，`acc20ed`补混合板子提示和旧配置断言，`0954991`补公开翻牌/遗言条款。后续全部线性本地提交，不推送。

CLI目录、能力授权、独立玩家/展示DTO、统一回放事实reader、工具metadata及旧接口清理、bot/provider拆分和有限规则配置均已落地。竞选PK、放逐PK与死亡持徽者选择已连通选民、候选、阶段、晚校验、单轮上限、二次平票/弃票、公共事件、双语展示、SDK/MCP统一preflight和实际严格Tape。

完整示例：[AWA十二人PK与警徽选择板子](../../../configs.example/boards/awa_classic_pk_choice_12_v1.json)。它是有限具名AWA产品规则，不是完整网易或赛事镜像。中/英两局同局实际录制包含竞选PK、放逐PK再次平票、次夜警长死亡和自主警徽移交，严格Tape复现一致。默认板子及省略参数保留原行为，未覆盖本地configs。

## P8 首项：咒狐功能闭环（2026-10-09）

咒狐implemented，首批City有限组合贯通配置/实际动作/伤害/独立胜利/双语/录制/Tape；三组审查及原报告复查关闭，见[角色验收](../reviews/p8-cursed-fox.md)。新源码后端2441/203174/212文件、前端229/2167/33文件、Chromium88/88均0失败，10板1000整局种子与48实际三transport双语完整局/Tape通过；2441全量运行后仅扩测试4项并补测通过，未重用旧运行冒称2445全量；root check/lint、前后端build通过，root format:check及diff检查通过。此项门禁不等同于P8其余角色、P9/P10或用户最终验收。目录仍23verified/1implemented/40planned。

## P8 第二项：丘比特（2026-10-09）

丘比特implemented，网易2017跟随情侣与Lui-même情侣独胜的具名策略贯通schema、实例、实际请求、关系闭包、胜利归属、私有DTO、双语、录制与Tape；三组审查修正并复查，详见[功能验收](../reviews/p8-cupid.md)。60实际本机三transport双语完整局/Tape、480受限观察机器人逐局Tape与1200独立World基线分别记录；最终后端2551/226151/216文件、前端238/2315/34文件、Chromium96/96皆0失败，check/lint/format及前后端build通过；完整门禁按该验收的新源码清单登记。当前目录23verified/2implemented/39planned，本项不关闭P8其余角色、P9/P10或用户最终验收。

## P8 第三项：杠精（2026-10-09）

杠精implemented，来源为Melbourne Masters 2026特定赛事，唯一具名AWA普通发言前改编。匿名活人严格过半、整局一次付费、临时普通/PK禁票、完整徽资格与配置权重、原发言顺序/骑士自爆间隙、生命/身份/phase撤权及前端活人翻牌均闭环；三组已报告项修复复查关闭。见[规则卡](../rules/awa-melbourne-debater-v1.md)/[验收](../reviews/p8-debater.md)。最终冻结源码后完整backend 2648/237397/219文件、frontend248/2411/36文件、Chromium104/104均0失败；check/lint/format/build通过。36实际本机双语三transport完整局/Tape、320受限观察局逐Tape、1008独立World基线分别记录。当前23verified/3implemented/38planned；首组事件道具/P9/P10继续，总体等待用户最终验收。

## P8 首组有限事件与道具：匿名墙（2026-10-09）

发行商New Moon匿名墙独立变体适配为AWA首日完整非终局Voting后一次窗口，唯一event pack与anonymous_note个人实例；默认关闭、七基础组合有限支持。schema/库存/私有提示、晚撤权/异常finally、匿名多重集合shuffle、God与公共矩阵、录制/严格Tape及共享回放呈现闭环。三组审查与共享夹具污染修正均复查关闭，见[规则卡](../rules/awa-wall-notes-v1.md)/[最终验收](../reviews/p8-wall-notes.md)。最终backend2726/247401/222文件、frontend258/2508/38文件、Chromium112/112全部0失败；check/lint/format、双端build通过。24实际双语本机SDK/ACP/MCP/混合完整局逐Tape，200受限自然观察局逐Tape与1000独立World基线分别记录。P8既定三角色和首组有限事件道具已implemented；不是36卡/通用道具全部实现。目录23verified/3implemented/38planned，P9/P10继续，总体待用户最终验收。仅本地commit，未push/真实模型/秘密读取。

## 当前 P8–P10 接续（024a933之后）

用户已验收上一批整改并授权普通推送，远端main核验为024a933；随后明确授权完成全部剩余任务。当前持续实施41角色、有限事件/道具与P10，具体约束见[p8-p10-continuation.md](p8-p10-continuation.md)。下方未验收/未push及P8–P10未开始说明保留对应历史批次语境，不代表本次授权边界。咒狐、丘比特、杠精、盗贼、野孩子、千面人、孤独少女与鬼魂新娘有限组合已启用并登记implemented，其余33项planned尚未启用；后续门禁按新源码独立记录；不将历史2389/223/82当未来角色验收。

## P9a 孤独少女（2026-10-09）

唯一AWA网易来源版本implemented，保持原Girl/Good民边、独立冻结崇拜目标阵营、死亡后胜利归属以及封盘前的身份秘密；标准N和七基础/City有限组合。原请求/组件/生命/目标/Victory授权、完整失败矩阵、God/lean reader、录制及实际strict Tape贯通，旧Hybrid行为保持，三组审查报告复查闭合。见[规则卡](../rules/awa-netease-lonely-girl-v1.md)/[验收](../reviews/p9-lonely-girl.md)。冻结源码完整后端3164/318832/237文件、前端312/3072/46文件、Chromium152/152全部0失败，check/lint/format和双端build通过；72实际双语三transport完整局/Tape、8严格失败partialTape、200受限Observed逐Tape、1000独立World分别记录。当前23verified/7implemented/34planned，继续鬼魂新娘/P9/P10，总体待最终验收；无push/真实模型/秘密操作。

## 本次 Seer/摄梦/狼美人实施与门禁（本提交，基线 ef2f48f）

原目录 main，兼容AWA默认。Seer已用eb4f026实际流水线采集并保存required请求约束，可重复脚本与六入口三夜Tape验证一致。新增 dreamer.protectionPolicy 两种版本；新增 wolf_beauty.deathLinkPolicy 的AWA默认/S7放逐原生猎人枪版本。2019空连/骑士抑制作为独立已支持约束，复合死因抑制优先与扩展夜伤免疫明确是工程补全；不冒称完整官方preset。

[历史来源/实现契约](historical-night-role-policies.md)说明schema→状态实例→执行/来源→双语提示/DTO→录制→严格Tape；[八类当前规则行为](current-rule-behavior.md)逐项列默认、已经配置的字段和无来源变体保留理由。用户configs、秘密、系统设置未触碰；没有push/部署/真实模型调用、新分支或worktree。

| 门禁            | 本次结果                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| 后端全量        | 2389通过，0失败，189737断言，209文件；四组741/559/496/593，均退出0，最长组248.93秒                  |
| 前端全量单测    | 223通过，0失败，2119断言，32文件                                                                    |
| 完整Chromium    | 82/82通过，0失败/跳过/不稳定项；当前功能提交05cd47b，1 worker、0 retry，186.72秒                    |
| 全源码/测试类型 | root check通过，配置未放宽                                                                          |
| lint/格式/差异  | root lint、format:check及git diff --check通过                                                       |
| 前后端构建      | 均通过；已有>500KB bundle提示保留                                                                   |
| 定向证据        | 66通过/1889断言/3文件；新文件25项含16局双语实际录制和严格Tape；Seer baseline probe与字面fixture一致 |
| 只读独立复核    | 未发现实质代码缺陷；旧transfer全状态保证文档已按实际kind检查纠正                                    |

209文件精确并集清单 `/tmp/arena-historical-backend-manifest.json`，各组日志/状态 `/tmp/arena-historical-backend-{1..4}.{log,status.json}`，汇总 `/tmp/arena-historical-backend-summary.json`。新源码首轮沙箱禁本地listen，SDK/MCP fixture报EPERM，日志保留为 `/tmp/arena-historical-backend-sandbox-*`；未修改测试/超时/断言或放宽规则，获准本地loopback离线fixture后按此前四组完整重跑得到上表。类型/lint/格式/前端/构建日志为 `/tmp/arena-historical-{check,lint,format,frontend,build-backend,build-frontend}.log`；基线实际请求 `/tmp/arena-historical-seer-baseline.log`。

本次完整Chromium门禁在干净main提交 `05cd47bee67b83b1328a6fdebfcb9eb9b3b89158` 上实际重跑，82/82通过，0失败/跳过/不稳定项；单worker、零重试，使用现有 `/usr/bin/chromium` 与新建127.0.0.1 fixture服务。日志 `/tmp/arena-historical-browser.log`，完整JSON `/tmp/arena-historical-browser.json`，含精确源码提交/命令/退出码的状态 `/tmp/arena-historical-browser.status.json`。此后仅更新本文件记录，功能源码保持05cd47b。运行初期因日志暂为空误判停住，原Bun运行实际自然完成；误启动的Node重复运行已取消，其日志/状态单独保留为 `/tmp/arena-historical-browser-node-cancelled.*`，不计门禁或失败。上一批82项仍仅是历史证据，不用于替代本次结果。网易2026页面此次只取得站点壳，使用此前已读条款加此轮可读2017/2019正文推进，不以抓取失败结束。机械+摄梦公开组合仍未开放，机械失败免疫只验低层frame/伤害矩阵；黑市+摄梦已支持并完成实际Tape分叉。外部平台所有板子、真实模型质量与视频导出未验证。P8–P10未开始，整体任务保持待用户最终验收。

## 上一批功能源码门禁（0954991）

| 门禁                             | 结果                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| 后端全量                         | 2363通过，0失败，188198断言，208文件；四组716/559/496/592，均退出0，最长250.57秒 |
| 前端全量单测                     | 223通过，0失败，2119断言，32文件                                                 |
| 完整Chromium                     | 82/82，0失败，3.1分钟；双语翻牌标记只在对应实际事件出现，回退时间线恢复          |
| 全源码/测试/工具类型、lint、格式 | root check/lint/format:check及git diff --check通过，严格配置未放宽               |
| 前后端构建                       | 均通过；已有大于500KB bundle提示保留                                             |

208文件精确并集清单 `/tmp/arena-public-death-backend-manifest.json`，结果 `/tmp/arena-public-death-backend-summary.json`，各组日志和status为 `/tmp/arena-public-death-backend-{1..4}.{log,status.json}`。新源码完成后全量执行一次，不因断连重跑。前端 `/tmp/arena-public-death-frontend.log`，浏览器 `/tmp/arena-public-death-browser.log`；类型/lint/格式及构建 `/tmp/arena-public-death-{check,lint,format,build-backend,build-frontend}.log`。

`e9e7fac`首次全量2327通过、4个旧配置断言失败；acc20ed更新正确默认/未知字段断言并新增两项提示回归。0954991新增30项（含八个双语完整局/Tape），最终全量2363项全部通过。早期public新增夹具的错误工具名、枚举和时间类型已修正；原生产超时、断言及历史回归没有放宽。

[原审查问题名与保留理由](original-review-closure.md)完成逐项对应及保护矩阵；新公开死亡参数见[契约](public-death-policies.md)。该历史批次没有新增平台夜序、同时灭绝、库存及梦/魅惑策略；本次已进一步新增摄梦/狼美人具名策略，见上方新门禁与历史契约。P8–P10仍未开始；本记录是提交和证据，是否满足用户验收由用户判断。

## 历史功能源码门禁（52103ea）

| 门禁                 | 结果                                                                         |
| -------------------- | ---------------------------------------------------------------------------- |
| 后端全量             | 2260通过，0失败，186352断言，203文件；四个隔离Bun进程均退出0，最长组244.67秒 |
| 前端全量单测         | 215通过，0失败，2069断言，31文件                                             |
| Chromium完整浏览器   | 80/80，0失败，3.2分钟，单worker，含播放切语言/无胜者和新增PK/警徽事件时点    |
| 全源码/测试/工具类型 | root check通过，严格配置未放宽                                               |
| lint                 | 后端依赖/导入/i18n及前端结构ESLint通过                                       |
| 格式和差异           | 全仓format:check、git diff --check及基线差异检查通过                         |
| 构建                 | 前后端通过；前端保留已有大于500KB bundle提示                                 |

后端四组分别通过661、547、460、592项，203文件各执行一次，清单与首轮完整命令一致，原断言与超时未放宽。首轮串行运行2251通过、1失败：旧女巫迁移测试缺少新增默认字段；已明确断言三个默认字段。修复后首次四组2252通过；最终审查发现provider失败可让fallback代选继任者，`52103ea`禁用该请求fallback并新增8项真实LLM/ACP provider回归，随后完整重跑得到上表2260项结果。

Chromium完整门禁在`90cb845`完成；其后`52103ea`仅改变后端警徽请求fallback与回归断言，前端及公开事件契约未变。历史2153项后端和78项浏览器结果只作为历史证据，不替代上表当前门禁。新警徽定向114项/1006断言、新PK定向71项/23818断言及完整组合2项/20断言是额外实现证据。真实本地SDK HTTP与MCP业务回执一致，preflight只选择不应用动作，临时死亡权限最终撤销。

## 逐项索引

以下25行按可核对请求与代码边界整理以便验收，不冒称三份原报告的原始编号。活动RoleCatalog自定义label/skillBrief/renderPrompt与TextLocalizationRegistry实际consumer保留；删除的是无人消费或重复的边界。

| 索引 | 核对项                                | 实施/定向验证                                                                      |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | CLI默认configs目录不依赖启动cwd       | 完成，统一目录解析与回归                                                           |
| 2    | 摄梦请求构造前/后及await后撤权        | 完成，真实stage scope回归                                                          |
| 3    | 女巫来源/资源/披露授权                | 完成，原生、复制、赠予隔离                                                         |
| 4    | 守卫生命/夜晚/目标授权                | 完成，preflight及晚提交回归                                                        |
| 5    | 预言家生命/历史/目标授权              | 完成，preflight及晚提交回归                                                        |
| 6    | 机械狼英文时间边界                    | 完成，语义澄清与机制回归                                                           |
| 7    | 前端全TS/TSX严格类型门禁              | 完成，包含测试、脚本及配置                                                         |
| 8    | 后端测试/工具脚本类型门禁             | 完成，不排除坏夹具                                                                 |
| 9    | 统一回放事实reader                    | 完成，原子拒绝坏事实和getter                                                       |
| 10   | label/关联/投影共用事实               | 完成，未知事件不猜状态                                                             |
| 11   | 独立PresentationReplay DTO            | 完成，过滤展示与保留seq间隙                                                        |
| 12   | player ownState独立白名单DTO          | 完成，结构过滤和冻结副本                                                           |
| 13   | 四角色26条重复中文工具描述            | 完成，机器schema等价                                                               |
| 14   | 工具规格静态模块边界                  | 完成，无runtime/state/profile导入                                                  |
| 15   | getLlmSchema及旧gateway schema副本    | 已删除，活动统一preflight保留                                                      |
| 16   | 三个无消费者文本contributor           | 已删除，活动本地化consumer保留                                                     |
| 17   | RoleViewRegistry旧视图边界            | 已删除，player DTO为唯一入口                                                       |
| 18   | 重复RoleSpecRegistry/死描述字段       | 已删除，活动RoleCatalog与自定义注入保留                                            |
| 19   | formatter/EditorConfig/lint           | 完成，格式独立提交和结构门禁                                                       |
| 20   | 全profile参数往返/默认/提示/Tape      | 完成，共享严格内部板子schema                                                       |
| 21   | 有依据Guard/HiddenWolf策略            | 完成，具名来源年代和真实语义分叉                                                   |
| 22   | Seer有限目标/行动策略                 | 完成，4组合及耗尽目标回归                                                          |
| 23   | Witch披露/selfHeal/用药闭环           | 完成，原生双药明确AWA实验非主流                                                    |
| 24   | ObservedBot handlers及LLM/ACP测试拆分 | 完成，3780动作/RNG对照和原测试AST保留                                              |
| 25   | 警长竞选/放逐PK/警徽选择/完整AWA组合  | 完成，候选/选民/最多一轮/再次平票、临时死亡权限、真实SDK/MCP、同局12人双语Tape闭环 |

## 关键提交与证据

- `37ec428`：机器parameters成为唯一工具规格，旧LLM/gateway副本删除；48贡献机器schema前后等价。
- `3ed0876`：三个旧contributor、RoleViewRegistry、重复RoleSpecRegistry删除；23角色权限派生前后等价。
- `d07e999`：ObservedBot稳定handler优先级与null/undefined语义；3780动作/RNG对照一致，35条LLM/5条ACP原测试AST保留。
- `c5257cf` / `242f9f8`：Seer有限目标/行动策略、Witch披露与独立原生用药实验闭环。
- `d8370ed`：真实竞选/放逐PK；`21bb26b`：警徽选择和死亡权限；`90cb845`：完整组合例与双语同局Tape/浏览器。
- `52103ea`：警徽请求明确`allow_fallback=false`，SDK/ACP空回复及非法回复不得代选继任者；8项双语回归验证fallback未调用、撕徽及权限回收。
- `78dc6a0`：独立机械格式提交，便于从功能差异隔开审查。`3496031` / `01e74ca`：播放输入稳定和无音轨静音启动。

该历史批次本机证据：`/tmp/arena-backend-final-summary.json`、`/tmp/arena-backend-final-shards-manifest.json`、`/tmp/arena-backend-final-shard-{1..4}.log`及对应`.status.json`；前端`/tmp/arena-badge-frontend-tests.log`，浏览器`/tmp/arena-current-full-browser.log`。类型/lint/格式日志为`/tmp/arena-final-{check,lint,format}.log`，构建为`/tmp/arena-final-build-{backend,frontend}.log`。首轮完整日志`/tmp/arena-current-full-backend.log`保留失败及修复历史。临时日志不保证长期保留，提交内测试和源码是可复现交付。

## 来源与验证边界

[规则证据](rule-evidence.md)区分官方年代、独立站与AWA产品策略；[警徽/投票契约](sheriff-voting-policies.md)列出完整有限流程。Guard/HiddenWolf具名策略只覆盖查证过的部分。Seer新策略是AWA口径；女巫原生双药明确为非已核验主流的AWA实验，赠毒、复制、转移不因此扩权。来源不足的新夜序、扩展复合死因、复制库存等没有冒称通用标准，P8–P10/64角色扩展仍是未来项目。

没有调用真实模型/认证GitHub/推送/fetch/pull/部署/运行真实配置对局，没有读取.env或秘密值。现有额外worktree及旧分支保留，无并行writer。浏览器只使用受控fixture与临时127.0.0.1服务。未额外生成PNG/MP4，也不把Player浏览器门禁称视频导出测试。原目录写入与离线验证已获授权；进度跨线程发送曾被自动审批拒绝（缺少目的地发送授权），没有绕过，当前对话与最终交付提供同样信息，不影响源码实施。

复核状态：此前“全部完成”结论撤回且不恢复为无边界承诺。Seer、原生死亡枪、具体角色查验、公开翻牌/遗言已补齐新源码门禁；其余原范围已按问题名核对并记录具体默认、源码与来源依据，未新增变体保持明确未实现。历史门禁只证明对应历史源码，不证明完整平台镜像、视频或后续角色目标。

## P9a 首项：盗贼（2026-10-09）

唯一来源策略真实N+2发牌、两Wolf必选与其它可保留、原生新身份/库存及首夜动作、原物理牌交换/晚授权、私有提示/录制/strict Tape和初始回放身份已完整贯通。52核心/失败Tape/样例测试，90实际双语三transport完整局及逐Tape、200受限ObservedBot逐Tape、1000独立World自然局分别验证。三组只读审查所有报告项修复复验关闭。最终后端2834/266021/225文件、前端267/2601/40文件、Chromium120/120均零失败；check/lint/format、双端build通过。见[规则卡](../rules/lui-meme-thief-v1.md)/[验收](../reviews/p9-thief.md)。当前23verified/4implemented/37planned，继续P9a其余角色及P9/P10；仅本地commit，整体仍待用户最终验收。

## P9a 第二项：野孩子（2026-10-09）

唯一来源AWA适配首夜必选榜样、实际完整死亡波次转真实阵营/胜利、下一实际Night才双向狼队权限、原始roster与严格因果Tape已贯通。47核心/309断言、60实际双语三transport完整局及逐Tape、8真实严格失败partial Tape、200受限观察局逐Tape、1000独立World自然局（788转换/678实际activation）分别验证。三组已报告问题修复并由原审查者复验闭合。冻结源码后全backend **2932/281583/229文件**、frontend **277/2696/42文件**、完整Chromium **128/128**均0失败；type/lint/format与双端build通过，双语12人实际PNG/shared frame已目检。见[规则卡](../rules/awa-lui-meme-wild-child-v1.md)/[验收](../reviews/p9-wild-child.md)。当前23verified/5implemented/36planned；main本地commit，继续千面人/P9/P10，总体待用户最终验收，无push/真实模型/用户configs或秘密操作。

## P9a 第五项：鬼魂新娘（2026-10-10）

唯一Melbourne来源AWA精确12人三方板implemented；首夜原请求共同婚礼、私聊/证婚人、原身份库存和独立胜利、普通狼/情侣/证婚人逐夜唯一刀owner、复合殉情/枪源、吞徽与完整Night终局闭环。严格God/四scope投影、CP安全库存/零getter和Proxy、实际provider失败/accepted提交边界及strict Tape贯通，三组报告修复复验关闭。见[规则卡](../rules/awa-melbourne-ghost-bride-v1.md)/[完整验收](../reviews/p9-ghost-bride.md)。最终全backend **3315/329141/246文件**、frontend **364/3862/48文件**、Chromium **172/172**均0失败；check/lint/format及双端build通过。24真实双语三transport完整局逐Tape、8严格失败partialTape、200受限Observed逐Tape、1000独立World及终局公开死亡逐人等于真实Alive分别记录。Observed每语言seed43一次盲枪合法拒绝精确断言，不冒零reject，fallback为0。P9a五角色技术功能已交付，目录23verified/8implemented/33planned；猎魔人规则候选审查继续，P9b–f/P10和总体用户验收保持开放。仅main本地commit，无push/部署/真实模型或用户configs/秘密操作。

## P9b 猎魔人有限原生夜间交付（2026-10-10）

原Seer/Guard在四种Demon候选板绑定真实Factory请求及严格scope，双语SDK/ACP provider类合法/非法/空回复均不fallback。Guard实际贡献封存与晚撤权保持合法库存；普通刀重算有效Guard/Heal，清印记后独立贡献及当前factory marks保留。51项新测试，定向135/713/4文件、受影响回归2372/22660/131文件均0失败；后端type/lint/dependency/boundary/i18n/build及局部格式通过，三组已报告问题复验关闭。见[本批记录](../reviews/p9-demon-hunter-native-night.md)。HTTP/ACP子进程整局、既定单一FaultPlan与严格Tape、四板公开登记及完整门禁仍是角色验收必要依赖；不新增故障操作。目录23verified/8implemented/33planned，角色继续实施，整体待用户验收。

## P9b 猎魔人既定 FaultPlan 实际边界（2026-10-10）

独立冻结输入在真实choice后/来源冻结前创建原actor或target替换Alive，mandatory fault_applied录制后由引擎自行取消，保持history/accepted op/原生消费。closing/closed录制静默漏录已修并复验。定向48/203/2文件、受影响回归2386/22774/132文件均0失败，后端source+tests type/lint/boundary/i18n/build及局部格式通过，三组只读报告已闭合。见[有限故障边界](../reviews/p9-demon-hunter-fault-engine.md)。metadata/Replay严格Tape与公开四板仍是已知必要依赖，角色planned，继续实施，不新增故障操作。

## P9b 猎魔人完整功能闭环（2026-10-10）

此前两个猎魔人阶段段落记录其历史未完成依赖；本批已完成公开四板、实际完整 SDK/ACP/MCP 通路、有限 FaultPlan 的严格 Tape、本人投影与中英展示。完整后端 3794/384095/260 文件、前端 389/4060、Chromium 184，均零失败；两份独立只读复核无 P1/P2。见[完整验收](../reviews/p9-demon-hunter.md)。当前 23 verified、9 implemented、32 planned，P9/P10 及用户总体验收未关闭。

2026-10-10 纯白之女／狼巫功能门禁通过：当前 23 verified、11 implemented、30 planned。四个公开预设、160 局严格模拟、双语成功和失败传输均通过；最终后端 3941 项、394536 次断言、269 文件，前端 395 项、4274 次断言、52 文件，Chromium 188 项均零失败。引擎及测试指纹前后一致，独立审查未发现可复现 P1/P2。见 [纯白验收](../reviews/p9-pure-white.md)。P9/P10 和用户验收仍开放。

## P9b 恶夜骑士与噩梦之影交付补记（2026-10-10）

恶夜骑士此前已通过后端 4084、前端 401、Chromium 194 项，见[验收](../reviews/p9-evil-knight.md)。噩梦之影四份公开预设及双语完整/失败传输、160 局严格模拟、玩家视角均通过；本批最终后端 4180 项、前端 412 项、Chromium 196 项零失败，见[验收](../reviews/p9-nightmare.md)。当前 23 verified、13 implemented、28 planned；P9/P10 和用户总体验收仍开放。

## 2026-10-11 赤月使徒有限板技术验收

两种末狼自爆策略的十二人赤月猎魔板已通过：真实自爆封夜、末狼延迟放逐与到期、刀毒猎魔先后及完整胜利结算、白痴票权和警徽、双语私有视角、严格 Tape 与实际 SDK/ACP/mixed 通路。最终后端 4313 项零失败；前端 416、Chromium 202 项零失败，前端输入指纹与原门禁一致，双端构建及静态检查通过。首轮后端 4298/9 失败及修复重跑如实留档，未将定向通过冒充全量。噩梦之影的 constructor/species 访问器兼容缺陷同批通过 red/green 及最终全量。
当前 23 verified、14 implemented、27 planned，37/64。详见 [验收](../reviews/p9-red-moon.md)。P9c–f/P10 继续，魔术师只是下一批草稿，不计完成。仅 main 本地提交，不自动推送。

## 2026-10-11 魔术师有限板功能门禁

魔术师四份十二人原生预设已贯通单次夜目标映射、原刀口信息、两种夜死枪口策略、双语私有事实、完整/失败 Tape 和真实 SDK/ACP/mixed。160 局 World、录制兼容性 128 项、前端 unit 421 项、Chromium 206 项零失败，双端构建与静态检查通过；详细范围、独立审查、失败修复和未执行门槛见 [魔术师验收](../reviews/p9-magician.md)。

当前 23 verified、15 implemented、26 planned，38/64；上方数字保留各阶段历史时点。按既有 delivery/持续实施契约区分功能提交与阶段全量，本批未重跑全部后端，P9c 收口必须执行全支持范围回归。定序王子先补重投依赖，再接诡术师标准合板；P9c–f/P10 与总体验收继续开放。仅 main 本地提交，不自动推送。

## 2026-10-11 定序王子有限板功能门禁

定序王子原生十二人公开预设完成首轮一次性重投、额外发言、警徽票权保留、严格失败前缀与双语私有/公开事实。40 局自然终局 World、真实 SDK/ACP/mixed、正常 PK 与 Tape 篡改拒绝、旧录制兼容性和界面验证见 [定序王子验收](../reviews/p9-order-prince.md)。

本批功能登记后 23 verified、16 implemented、25 planned，39/64；历史条目保留当时数字。P9c 阶段全量与 P10 总体验收仍开放，继续诡术师组合及后续角色。只在 main 本地线性提交，不推送。

## 2026-10-11 诡术之境有限组合功能门禁

诡术师、魔术师、定序王子精确十二人组合已贯通夜间私有选择、同对抵消、资源消耗、最终有效放逐映射及严格失败前缀，提供 awa_trickster_12_v1 公开配置。双语 World、SDK/ACP/mixed、录像重放/篡改拒绝与界面证据见 [本批验收](../reviews/p9-trickster.md)。

本批功能登记后 23 verified、17 implemented、24 planned，40/64。P9c 阶段全量、其余角色和 P10 仍开放；历史条目保留当时范围与数量。main 本地线性提交，不推送。

## 2026-10-11 狼术师有限魔幻对决板

公开 awa_wolf_sorcerer_12_v1，证据见 [本批验收](../reviews/p9-wolf-sorcerer.md)。当前功能目录 41/64；其余角色、P9c 阶段全量与 P10 仍开放。
