# 狼美人放逐胜利职责

## 范围与所有权

本批实际基线 `5549ba0c0714bdea5a2056f01773858eb5cf0008`，5 个源、无删除：阶段经理、狼美人 relation／ports、具名 `rulesets/beauty-exile-victory.ts`、新有限单元。三个旧源和五个控制文件均按真实 Git 原文保存；其他并行夜流水线／导师代码不算不可变控制。

规则组合完整拥有有效放逐目标选择、末狼与目标侧捕获、波后 applied／原体／目标实际死亡与整侧核对、真实 Victory 成员结果，以及屠边覆盖数据。没有第二份关系、投票器、付款、死亡写入或封盘。

relation 继续唯一持有 bindings、resolved、applied 和完整 current 算法。新增 `isCharmBindingCurrent` 是同一函数的具名 alias，ports 直接导出它和原 activeCharm，不新建转发函数或状态。原 relation 的 `BeautyExileCandidate`、`captureBeautyExile`、`resolveBeautyExileVictory` 入口退休；候选和实际解析迁新 owner，capture 是它内部的完整函数。

## 时点与失败前缀

- 动物分支不产生本候选。普通板只有原 removed 非空分支准备候选；effectiveTarget 有定义时仍读两次，nonnull → removed.includes → World 的顺序保持。
- actor 查询先于 activeCharm，即使演员不合格仍保原查询。末狼／目标侧在死亡波前捕获，同一 binding 和原可写候选保留，不重推断波后目标侧。
- previousExile、来源形成和死亡 await 仍在经理原点；await 后先 votingIsCurrent，失效返回不再读判胜 World。null 候选仍在原 resolve 调用点经过原短路。
- 已领取或保护阻断不能当作 applied。原体／政策／生命版本失效仍拒绝；复活不能重新使用旧候选，拒绝不恢复已付领取或已提交死亡。
- resolve 完成后才读取 checkAndSealResult callee → checkpoint → 第二参数中的覆盖条件和 SlaughterSide key。覆盖不能提前组装，不强迫优先于配置前面的屠城项。
- checkAndSealResult／sealResult 全算法不迁：gameOver、配置首命中、狐狸改写、phase 实参、故障计划、婚约分配和成员／日期验证、唯一终态写入保原。胜者成员仍由 Victory.affiliations 捕获，而非 Role.camp。

候选只供经理内部这一结算；本模块不将候选交给玩家提示或档案。readonly 只是查询输入声明，不冻结原数组或绑定，也不授行动／死亡许可。

## 实际验证

完整 PM／relation／ports 精确正逆，两个迁移函数、原候选声明、完整 prepare 三语句、覆盖表达式和 current 函数分别从真实当前源码核对：**7,094 typed nodes、8,577 非注释叶、18 全程序映射输出相同**。新测试两处类型断言另有 2 个完整 ES／CJS 输出相同；未用整个旧 PM body 代替验证新 owner。

五个控制文件：原状态、死亡波贡献、条件注册表、Victory 结果构建、原 charm 场景；全部真实 Git 字节保持。

- 新 3 case 首轮 2 pass／1 fail／24 assertions；失败发生于新测试自己的不可配置 getter 重定义。仅将该 fixture 标志改为 configurable，failed-only 1 pass／10 assertions，另两绿不重复。
- 原先屠城后屠边精准场景 1 pass／5 assertions，26 filtered；原标题、动作、预期和 fixture 完全不改。
- 成功 distinct 合计 **4 case／31 assertions**（新 3／26、旧 1／5），不是三次执行断言数量的相加。
- 5 roots 类型首查只新 unit 两处 TS2345；测试局部回执断言收窄、原运行对象不变后，failed-only 1 root 真 terminal exit 0。首五根和失败收据均保留。
- 原 checkComments 只本批 5 roots／594 Git 文档，一次 diagnostics 0、中文头缺失 0；未运行全结构门禁、整局、模型或网络。

## 绑定与限制

七个当前根的 TS/MTS/CTS/TSX/JS/MJS/CJS/JSX 字面库存 1872 files，覆盖 import／export／importType／字面 dynamic、require／importEquals；relation 的实际 18 接线无旧候选入口消费。首 proof 的路径预筛只计 13 处，遗漏同族相对路径，因此单独补库存，不改首报告或重跑已绿程序证明。

当前后端相对字面值图 497 modules／1,635 edges，没有回到新 owner 的边；外部包、非字面加载和完整 cold 执行不计。这是本次当前树的采样，不能当其他并行源与基线字节相同。

物理 API、公开 alias、返回容器及初始化路线发生明确变化；不承诺旧私有路径或任意模块 namespace 改写的反射语义保持。新源码／路径和中文注释会参与新 sourceHash；指纹算法、档案格式、校验政策和历史档案身份保持，未提供跨构建复现豁免。

本批只完成这一职责，未宣称整个 C24／C28、全量行为、C45 或 P9 已验收。功能提交由 Root 在交叉审查后完成。
