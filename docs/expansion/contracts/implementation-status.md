# 授权整改实施记录（逐项复核与新源码验收）

最新功能源码：`095499186eff4748a46ef2f18d0834d5cb36f969`，原目录 `/home/hby/dev/AI-Werewolf-Arena` 的 `main`。基线 `eb4f026a38205d420cc2172b32fe23a29cb00da0`。`14f9e3c`修正Seer默认，`e9e7fac`补原生死亡枪及三角色查验策略，`acc20ed`补混合板子提示和旧配置断言，`0954991`补公开翻牌/遗言条款。后续全部线性本地提交，不推送。

CLI目录、能力授权、独立玩家/展示DTO、统一回放事实reader、工具metadata及旧接口清理、bot/provider拆分和有限规则配置均已落地。竞选PK、放逐PK与死亡持徽者选择已连通选民、候选、阶段、晚校验、单轮上限、二次平票/弃票、公共事件、双语展示、SDK/MCP统一preflight和实际严格Tape。

完整示例：[AWA十二人PK与警徽选择板子](../../../configs.example/boards/awa_classic_pk_choice_12_v1.json)。它是有限具名AWA产品规则，不是完整网易或赛事镜像。中/英两局同局实际录制包含竞选PK、放逐PK再次平票、次夜警长死亡和自主警徽移交，严格Tape复现一致。默认板子及省略参数保留原行为，未覆盖本地configs。

## 最新功能源码门禁（0954991）

| 门禁                             | 结果                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| 后端全量                         | 2363通过，0失败，188198断言，208文件；四组716/559/496/592，均退出0，最长250.57秒 |
| 前端全量单测                     | 223通过，0失败，2119断言，32文件                                                 |
| 完整Chromium                     | 82/82，0失败，3.1分钟；双语翻牌标记只在对应实际事件出现，回退时间线恢复          |
| 全源码/测试/工具类型、lint、格式 | root check/lint/format:check及git diff --check通过，严格配置未放宽               |
| 前后端构建                       | 均通过；已有大于500KB bundle提示保留                                             |

208文件精确并集清单 `/tmp/arena-public-death-backend-manifest.json`，结果 `/tmp/arena-public-death-backend-summary.json`，各组日志和status为 `/tmp/arena-public-death-backend-{1..4}.{log,status.json}`。新源码完成后全量执行一次，不因断连重跑。前端 `/tmp/arena-public-death-frontend.log`，浏览器 `/tmp/arena-public-death-browser.log`；类型/lint/格式及构建 `/tmp/arena-public-death-{check,lint,format,build-backend,build-frontend}.log`。

`e9e7fac`首次全量2327通过、4个旧配置断言失败；acc20ed更新正确默认/未知字段断言并新增两项提示回归。0954991新增30项（含八个双语完整局/Tape），最终全量2363项全部通过。早期public新增夹具的错误工具名、枚举和时间类型已修正；原生产超时、断言及历史回归没有放宽。

[原审查问题名与保留理由](original-review-closure.md)完成逐项对应及保护矩阵；新公开死亡参数见[契约](public-death-policies.md)。其余新平台夜序、同时灭绝、库存及梦/魅惑变体没有新增，保留理由具体记录，不能称这些变体已交付。P8–P10仍未开始；本记录是提交和证据，是否满足用户验收由用户判断。

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

最新本机证据：`/tmp/arena-backend-final-summary.json`、`/tmp/arena-backend-final-shards-manifest.json`、`/tmp/arena-backend-final-shard-{1..4}.log`及对应`.status.json`；前端`/tmp/arena-badge-frontend-tests.log`，浏览器`/tmp/arena-current-full-browser.log`。类型/lint/格式日志为`/tmp/arena-final-{check,lint,format}.log`，构建为`/tmp/arena-final-build-{backend,frontend}.log`。首轮完整日志`/tmp/arena-current-full-backend.log`保留失败及修复历史。临时日志不保证长期保留，提交内测试和源码是可复现交付。

## 来源与验证边界

[规则证据](rule-evidence.md)区分官方年代、独立站与AWA产品策略；[警徽/投票契约](sheriff-voting-policies.md)列出完整有限流程。Guard/HiddenWolf具名策略只覆盖查证过的部分。Seer新策略是AWA口径；女巫原生双药明确为非已核验主流的AWA实验，赠毒、复制、转移不因此扩权。来源不足的新夜序、扩展复合死因、复制库存等没有冒称通用标准，P8–P10/64角色扩展仍是未来项目。

没有调用真实模型/认证GitHub/推送/fetch/pull/部署/运行真实配置对局，没有读取.env或秘密值。现有额外worktree及旧分支保留，无并行writer。浏览器只使用受控fixture与临时127.0.0.1服务。未额外生成PNG/MP4，也不把Player浏览器门禁称视频导出测试。原目录写入与离线验证已获授权；进度跨线程发送曾被自动审批拒绝（缺少目的地发送授权），没有绕过，当前对话与最终交付提供同样信息，不影响源码实施。

复核状态：此前“全部完成”结论撤回且不恢复为无边界承诺。Seer、原生死亡枪、具体角色查验、公开翻牌/遗言已补齐新源码门禁；其余原范围已按问题名核对并记录具体默认、源码与来源依据，未新增变体保持明确未实现。历史门禁只证明对应历史源码，不证明完整平台镜像、视频或后续角色目标。
