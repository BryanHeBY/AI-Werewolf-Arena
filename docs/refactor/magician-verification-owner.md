# 魔术师归档验证归属

## 范围与职责

基线为真实提交 `d9be88a2b9fe3834348bf310956099581e81a439`。本批共七个源码路径：两个旧叶删除、两个新叶、三个消费者更新；不修改记录结构、写入器、生产规则或游戏行为。

| 原路径 | 现行所有者 |
| --- | --- |
| `backend/src/recording/magician_record.ts` | `backend/src/verification/reproduction/magician/validate.ts` |
| `backend/src/recording/magician_action_evidence.ts` | `backend/src/verification/reproduction/magician/action-evidence.ts` |

两个模块实际只读取归档并独立推导换位、目标、枪击与失败事实，不执行落盘。新的位置与职责一致：`validateMagicianRecord` 仍拥有原完整验证算法，`inferMagicianGunSources` 仍拥有原行动证据推导。它们没有加载 World、生产死亡算法或资源写方；结构／归档验证不构成真实行动授权。

原记录类型继续以 `import type` 依赖唯一的 `recording/reproduction` 声明。有限板子判断仍由原独立 `verification/board-support` 所有者提供；稳定枚举和事实读器仍来自原中立契约。没有新增服务层、公开包入口、注册表或算法桥。

## 接线与保真

- 实际消费者是 `verification/reproduction/assembly.ts`、魔术师场景、狼王场景，三者直接导入新的验证叶。
- 全仓路径／符号盘点只发现上述三消费者与 validator 内部 helper 的四个原 import。装配 unit 中的函数名是原顺序预期字符串，保持不变；旧路径没有 namespace、动态、package 或活动 Markdown 消费。
- 共七处 module specifier 编辑。所有函数、规则、源字面、错误码、字段读序、失败前缀、测试标题、输入、fixture 与预期完整保持，既有中文头及内部说明没有改动。
- 两个旧 `recording` 叶物理删除，不保留出口桥。旧私有模块路径 API 退休；函数名和实际绑定没有替换。

完整五程序从现行源码开始，只精确还原七处已声明路径，得到与实际 Git before 完全相同的源文本。对照覆盖 **18,099 个 typed 节点、全部非注释字面叶、10 份 ESNext／CJS 完整原始输出**。全部 **74 个 import binding** 的名称、type-only 模式及最终实体端点逐项核对：21 个位于移后模块或改路由，53 个原位不变。四个控制文件仍为原完整字节；两个删除叶分别记录原 Git SHA 和 `expectedAbsent`。

## 有界验收

| 检查 | 实际结果 |
| --- | --- |
| 原装配顺序／完整 parser 两个纯 unit | 2 pass、0 fail、5 assertions，另 2 filtered |
| 五个现行 TS roots 的有限类型检查 | session `86237`，terminal `bbbb2e`，实际 exit 0 |
| 五个现行职责头／中文首头 | 476 个真实 Git 文档路径；两项均 0 诊断 |

类型日志零字节不作为成功证明，成功来自真实终态回执。首证明工具误用同名回调变量，出现 `TypeError c.push is not a function`；只修工具变量遮蔽，实际重新执行通过，不修改产品。没有重跑两个 board 场景、整局、模型、全类型或全门禁。

## 限制与下一步

本批证明位置迁移和真实绑定保持，没有重新验证所有玩法规则。模块 URL、加载路径、栈位置与构建来源指纹会变化；历史原指纹保留，不提供跨构建重放豁免。其它仍位于 `recording` 的独立 verifier 不是本批范围。并行 Demon 的 PM／Night 等源码不作为本批 whole-Git 控制；有限类型的传递闭包可以包含这些稳定生产文件。

源码已冻结，尚未提交；独立审查后由 Root 按这一完整职责边界提交。持久原文、精确编辑、证明、收据及删除清单见 [交付证据](generated/magician-verification-owner-evidence.json)。
