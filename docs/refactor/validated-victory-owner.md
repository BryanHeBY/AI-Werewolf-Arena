# C29 终局候选完整验证 owner

实际来源 `c946777b`，一个原经理、一个业务验证模块和一个新单元测试的最终摘要、真实收据与双方向审查见 [固定证据](generated/validated-victory-owner-evidence.json)。

## 实际分工

`win_conditions/validated-victory.ts` 完整持有原候选的 outcome 结构、winner／reason、Victory 成员和决定时点验证。结果只包含已验证数据，不授予行动权限或自动封盘。

阶段经理继续拥有 fault 消费／wedding 前置、胜负候选选择、必要死亡链及检查点、唯一 result／gameOver 写、原阶段关闭和事件发布。没有通用封盘框架或另一个终态 store。

## 顺序与成员

完整结构 → winner／reason → Victory 归属成员 → day／point 保原第一失败顺序。World 在原两个读取点晚执行，日期只在成员验证之后读。返回不提前读 reason；经理仍在原 result RHS 读取它，保持 state LHS 和其它 getter／异常前缀。

胜利成员来自明确 Victory 归属，不按真实阵营、角色或当前 alive 猜测。单人、关系、附加胜利和 no-winner 的原规则保持，失败发生在 state／gameOver／事件写之前。

## 中文说明与有限验收

- 新 3 + 原 custom forged-membership 1：实际 `4 pass / 0 fail / 11 assertions`，6 其它场景未运行。角色阵营与胜利归属故意不同，字面输入／预期覆盖原成员、late world／day 和第一拒绝。第二例只验 winner，不冒全部 reason 异常覆盖。
- 首有限类型 session `24504` 仅新 matcher enum 约束诊断；`expect<unknown>` 保字面预期和 JS 后，session `62499` 实际终态 `0`。未放宽原 strict 配置。
- 原完整 validation block AST 同；将实际调用精确逆回经理后，完整非 import ESNext／CJS 原字节同。全文件 formatter 的无关 Exile 换行已退至原字节，不扩大本批格式变更。
- 三职责头与数据／权限／顺序说明中文；另把原错置的浅拷贝说明修成真实 snapshot／event structuredClone 和 audience freeze。只注释增量由两个独立方向复核 SHA，不重 types／runtime。
- Root 实际源审及两个方向最终三路径、真实 Git、完整程序／失败前缀和字面测试审查无待修项。

原归档、规则、RNG 与 strict 构建政策不改，新源进入完整指纹。当前完整候选验证已归 owner；全 C29 必要链／终局矩阵及最终同输入全门禁仍待后续汇合，未运行整局、网络或模型。
