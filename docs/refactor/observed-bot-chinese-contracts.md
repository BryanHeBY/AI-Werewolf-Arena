# 受限观察策略九叶的中文契约

基线为真实提交 `813ebb9de50ff68e17cfda2742eaa0f80cd75f92`。本批只改 `backend/src/ai/agents/providers/observed_bot/` 下九个业务叶的注释，不修改观察、策略、回退或领域提交算法。

| 文件 | 具体说明 |
| --- | --- |
| `copied.ts` | 已告知继承日期／所学历史只影响候选模式；不在本叶确立复制或资源资格。原机械查验／毒药先抽目标再检查风格，机械攻击保留原不按风格跳过的选择。 |
| `fragrant_pair_seer.ts` | 仅用请求二人候选，绑定可明确空选，查验缺任一目标仍抛原错误；依次抽取和排除顺序保留。 |
| `granted.ts` | 赠予／交易只选择受赠者和技能，先首夜保守短路，再抽目标，只有目标存在才抽技能；不写库存或授予能力。 |
| `mist_raven.ts` | 迷雾只改本地候选副本，不足三人为空组；灵蛇用请求首项，鸦爪按原概率与候选顺序。 |
| `noble_secret_body.ts` | 已知队友只是竞争型夜仆偏好；护自己须已在请求名单内，不补判真实阵营或扩大候选。 |
| `public.ts` | 实际还消费本人私有查验知识，不能因文件名宣称只读公开事实。能力历史空数组不触发原生历史回退；查验只影响投票偏好，未知死亡不补读。 |
| `radiant_eclipse.ts` | 庇护／吞噬的空目标仍是具名动作，区别于 handler 返回 null；同名工具观察不授予具体实例许可。 |
| `wedding.ts` | 自己的成员／可刀视图不是原生命或请求许可；已有提名按原空值优先，婚约刀保留见证人分支，不查询关系原体。 |
| `wolf.ts` | 显式刀候选优先，队友知识不等于当前资格或真实阵营；魅惑及自爆偏好保持历史／概率顺序。 |

## F01 与真实授权边界

旁核了 `PlayerObservation`、捕获方、共同 context／handler 装配、`ObservedBot` 和生产 `ObservationFallbackStrategy`。`knownAliveIds` 按已公布死亡形成，不能当作实时生命；候选、历史、已知队友和能力提示都不是 World／原体许可。

F01 的 literal true 检查实际位于生产回退外层，分别消费自己的 `canChat` 和 `canVoteForKill` 快照；这些业务叶没有自行执行该检查，普通 `ObservedBot` 也没有同一外层过滤。注释没有扩大 F01 声称或新增筛选。当前性、生命、库存、目标和付款仍由机制在提交处复验。

保留所有标识符、工具名、错误、发言产品文本、原 allowedTools／handler 顺序、null／undefined／空目标差异及 RNG 位置。没有修改任何测试、指令、许可证、i18n、历史证据、进度或机制矩阵。

## 一次有限证明

- 真实 Git before 保存逐文件原始全文／SHA／blob；32 项精确编辑记录覆盖 34 个位置。只逆明确注释后，九程序全文与实际 Git 原字节相同。
- 完整 typed AST（包括全部 NodeArray）、全部非注释 token 树／原字面和两种完整 emit：2,934 typed 节点、5,082 token 树节点、3,164 叶；18 份 ESNext／CommonJS 输出逐字同。`6bf61f` 实际退出 0。
- 原 `checkComments` 精确九根、519 个实际 Git 文档路径：`b1ec0d` 实际退出 0，没有失败根或重复绿检查。中文首头存在性另作本批采样，不以数量代替说明真义。
- 同行指出 Mist 首头“去重”过强：原数组仅移走抽中的一项，不拒绝重复输入。已只将该头改为“逐次抽取并移走已抽项”，不改算法或输入接受面；保存全文后单源注释桥核 513 个 token 树节点和两份完整输出相同（`a37bc6` 退出 0）。原九源程序／职责检查报告仍绑定原采样字节，不重复绿色检查，其余八源哈希不变。
- 末证明脚本的模板残留另行整理：首头“五程序”改为“九程序”，删去六项未写回的内存报告改写。实际 `a37bc6` 执行版逐字保存在 `peer-comment-proof-executed.cjs`，原九源 18 份输出与注释桥 2 份输出报告不改；当前整理版未重运行，两版 SHA 及来源见 [`tool-history`](generated/observed-bot-chinese-contract-comments-tool-history.json)。产品九源和范围哈希保持。
- 测试、类型编译、全量门禁和模型运行数均为 0。没有新增规则、冻结、schema 或权限屏障；有限纯注释证明不代表全 C45／F01／最终目标验收。
- 源码注释进入新构建来源指纹，历史记录及指纹不改，不承诺跨构建复现豁免。

本批已冻结，独立审查由 Root 调度，作者不提交 Git。[范围](generated/observed-bot-chinese-contract-comments-scope-final.json) · [精简证据](generated/observed-bot-chinese-contract-comments-evidence.json)。
