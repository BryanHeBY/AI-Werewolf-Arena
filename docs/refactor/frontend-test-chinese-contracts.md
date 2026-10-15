# 前端测试与配置中文维护说明

## 实际范围和输入

真实基线为 `15424a8426ca0e689e039a3b9d9240dc05c21fcf`。81 个既有路径包含 20 份浏览器 e2e、3 份 CLI／渲染集成测试、3 份归档 support、54 份单元测试和 Playwright 配置。完整 Git 原文、mode／blob、SHA 与开工现行字节一致，保存在 `frontend-test-chinese-contracts-before.json`；这些不是旧 source-ready 文本。工具、类型和断言标题的原文不翻译。

首轮 94 条精确编辑为 80 个英文职责头与 14 条内部维护说明。`offline-replay.spec.ts` 原头已中文，只翻其两条内部说明。首轮后仅六个失败头修订 6 条，再按 Root 非作者审查将 Order Prince 头中一词校准为正式“定序王子”；累计为 101 条**编辑记录**（94＋6＋1），并非 101 份不同注释或测试。原首 94 记录、SourceReady、proof／head report 与 raw 输出都完整保留。

四份整源 controls 为 `frontend/src/replay/{replay-projection.ts,replay-frame.ts,replay-event-reader.ts,ReplayComposition.tsx}`，与实际 Git 同字节；本批不写这些生产模块。fixture manifest 的五个 sourceAssets 和三个 moduleRelocations 唯一目标全部排除，不改其 currentSha／bytes 或原 program contract，也不触及归档、sample、模型及 i18n 文本。

## 中文含义与实际协作边界

- 浏览器测试消费原 replay、checkpoint 和玩家档。手写人数、存活、胜者、持徽与未知身份预期，与归档终态对照分开说明。实际 eventLabel／帧／投影输出可用于字幕或一致性对照，不称为独立字面 oracle，也不重新执行游戏规则。
- 私有画面仅从真实玩家档导出事件构造。God 外壳提供公开席位／姓名等必要资料，其他原生身份被遮蔽；公开翻牌只能在其实际事件帧显现。源 seq 与筛选后呈现索引不同，跳转／倒看检查各自原边界，不把画面状态当后端许可。
- 动物、寻香、光蚀、夜之贵族／觉醒愚者、继承、赠予、交换和特殊胜负测试各说明具体事实与生命／库存／知识的区分。信息披露、选择、反噬提案或受赠阶段不等于立即死亡；终局已死胜者与仍存活席位分别核对。角色名按现行 catalog（含蚀时狼妃、炼金魔女、狼鸦之爪）校准，机器 ID 不改。
- support 的归档成员选择、文件读取与遮蔽构造分别归原函数；不把样本定位视为生产可见性投影或 oracle 生成。schema／事实 reader 的接受和拒绝与加载格式宽度分开，不声称任意 Proxy 零 trap。getter、环与未定义字段反例只覆盖原真实断言范围。
- CLI 集成使用真实子命令及文件系统，错误码／安全文案是手写预期；渲染清理测试使用注入的假浏览器适配器，检查竞争输出、原文件不变、await close 与原 AggregateError 顺序，不能写成真实浏览器验收。Playwright 只拥有浏览器发现／启动配置，不拥有渲染与领域规则。
- 纯帧和静态 markup 组件测试保原帧号、每事件帧数、两语设置、独立字面数组与 fixture 对照。断言、title、协议、样本路径及任何字符串、签名、exports、运行语句都不变；整条工具指令原文保留，包括唯一 `@ts-expect-error`。

完整阅读这 81 源，并结合真实统一 reader、snapshot/frame、ReplayFrame 和 fixture 选择／CLI 渲染调用点核对上述含义；这里只说明已读消费边界，不冒全部运行闭包或任意外部 API 等价。

## 实际验证阶段

Root 唯一首执行完整 proof：`29b7c8 / session 11776 → f8cb02 / exit 0`。94 条精确正逆覆盖 81 份整程序，65116 typed nodes、12121 NodeArrays、79683 非注释语法叶、0 程序化 JSDoc tags，唯一受保护指令保持；162 份 ES2022 ESNext／CommonJS whole raw 输出相同（TSX 走 ReactJSX）。统计为真实脚本遍历口径，不是行为／调用图覆盖。

首职责头 `ca974a / exit 1`：81 源、736 个当次索引文档路径，11 诊断涉及 6 根，中文失败 0。Mist／Radiant 私有 e2e、Gravekeeper／player-shot 头缺明确职责动词，Mist 私有／RedMoon／Cupid-display 头未明确独立预期来源。保原真实红；不是业务执行失败。

六源只修头后，Root `59cf21 / exit 0` 完整桥得到 3561 typed nodes、626 NodeArrays、4286 非注释语法叶和 12 份整输出相同，另 75 源逐 SHA 同首阶段。仅失败六头 `f88524 / exit 0`，当次文档路径 737，诊断／中文失败 0。没有复跑首 81 程序证明或另外 75 个绿色头。

Root 末单词桥 `006dcf / exit 0` 核对 503 typed nodes、100 NodeArrays、594 非注释语法叶及两份整输出相同，另 80 源、全部原 proof／head／raw 字节不变；未重职责头或任何绿色检查。首正式改动源全文及 scope／MD／evidence／author／handoff／receipts／final-ready 全文保存在 `role-name-first-formal-snapshot.json`。首正式 MD／evidence 把真实 11 诊断沿口头误记为 12，现仅修文字；实际 heads JSON、raw 和 receipts 原计数从未改为 12。

五次 stdout／stderr 均原样重定向并保存，准确命令、来源与阶段见 receipts。首 SourceReady `checksRun=false` 仅表示首次静态冻结；final-ready 内后继未运行也仅表示修订冻结时点，现收据记录其实际执行结果。无 types、业务测试、生产加载、模型或全门禁执行；源码 SHA／行号变化不豁免严格历史身份。

## 冻结和审查范围

最终 81 源按原序列绑定 scope／evidence；纯注释 AST／NodeArray／叶、受保护指令和双输出证明只承接文本程序保持。职责头通过不代替中文准确性审查，现有业务绿不因翻译重跑，不称 P9 总验收。review／author／handoff 不进入作者 artifact 摘要，避免循环。
