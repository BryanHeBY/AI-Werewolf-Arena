# 选择与后续效果归档核验归属

## 完整所有者与输入

实际 Git 基线为 `e601e69a0c0904785f5e95e33a1bb56153a43bfc`。本批十个源码路径包含七个现行候选、三个删除的旧叶：

| 原叶 | 完整新所有者 | 实际消费者 |
| --- | --- | --- |
| `recording/order_prince_record.ts` | `verification/reproduction/order-prince/validate.ts` | assembly 与定序王子 board 场景 |
| `recording/time_consort_record.ts` | `verification/reproduction/time-consort/validate.ts` | assembly 与蚀时狼妃 board 场景 |
| `recording/scholar_mentor_record.ts` | `verification/reproduction/scholar-mentor/validate.ts` | assembly 与学者／导师 board 场景 |

表中源码路径均相对于 `backend/src/`；三个场景的精确路径见冻结清单。原三验证器分别 422、512、928 行，共 **1,862 行完整独立算法**，包含本地 `check`／`equal`、选择、资源及存活历史重建等 helper，整体迁移。它们只读取归档并验证选择与其后效果的因果对应，不录制、不落盘、不持有 World，也不复用生产技能或伤害算法计算预期。

实际生产消费者只有装配入口；每族另有一个 board 场景 named import。装配调用位置、函数名与读取次序不变，unit 内原三函数名字符串保持。当前生产／测试／包文字检索没有旧路径或重导、动态字面入口；不主张穷尽解析任意计算拼接的模块路径。

`ReproductionRecord`／`RecordedDecision` 仍 type-only 指向唯一 recording/reproduction 声明。三个共享 checkpoint 格式与录制写方留在 recording；Noble→Demon／RedMoon、Mist 共享证据、Radiant 相依族均不属于本批。没有新增 BaseVerifier 或通用资源框架。

## 路线与有效中文说明

实际 **14 处 specifier** 分为 13 个精确编辑项：定序王子原两个 board-support import 仍分别保留，同一文字出现两次；其余为板子支持、原 speech sanitizer、记录类型和六个消费者路径。所有 import 顺序、type-only 模式和最终声明实体保留。

十二项 comment-only 编辑覆盖三场景头及真实算法说明：

- 定序王子：已验证的激活选择才清旧票重投；映射只消费当轮 `vote_summary` 留下的原始目标。每个事件保存选择、存活与警徽前缀，checkpoint 按同一 `eventCount` 核对。
- 蚀时狼妃：反射事实先成为待匹配证据；后续原生效果核源、请求号码与技能种类，阶段切换、夜结算和归档末尾均不能残留 pending。锁定、触发日、存活与能力库存按事件前缀独立重建，不恢复 live 许可。
- 白昼学者／寂夜导师：只在 finalized 归档核对夜伤害操作；expected 来自本地独立账本，不取操作 output 作预期。选择／资源、存活和能力各保留同位置前缀，不以尾部最终态代替 checkpoint 历史。
- 头部角色名对应现行 catalog；原场景 English 头译成准确中文层级与证据说明。Role、政策、事件、错误、产品文本、历史原文和 test title 不翻译。

原所有 body、字段、字面、fixture、actions、asserts 和接受／拒绝政策不变。纯账本不是实际库存、付款或原体生命授权；本批不修规则或改测试样本。

## 有界证明和真实收据

七个 final 整程序逐项逆声明的路线与中文注释后，与七个实际 Git before **完整原文相同**。完整 typed AST **22,366 节点**、全部非注释字面叶和 **14 份 ESNext／CJS 原始完整输出**一致。六个有注释变化的整程序另做 comment-only 代码／输出比较；其原文相同字段为 false，准确表示说明文字确有变化。

全部 **102 个 import binding** 的模式、名称与实体端点核对通过：36 个位于迁后所有者或改路线，66 个原消费者绑定原样；36 不是 specifier 编辑次数。九个控制文件保留完整字节，三个旧叶以原 Git SHA 和 `expectedAbsent` 记录删除。

完整证明 session `22254` → terminal `02f8e8` 实际退出 0；七根有限类型 session `42231` → terminal `4e1187` 实际退出 0。日志零字节不构成成功证据，成功由实际终端回执确认。首头／职责与中文检查 tool `edc9ae` 退出 0，七输入、当时 **495 个真实 Git 文档路径**，各零诊断。之后仅两处内部说明精度调整，首头和代码／类型不变；首头原捕获 SHA 如实保留，最终完整证明绑定 final 七源，不伪造重跑收据。

本批**没有运行测试**。同装配 getter 链此前已核验，此次没有新调用风险；按方案不重跑原已绿 getter、parser、Tape／完整场景或全门禁，不声称本批新增运行断言。并行 Seer 和 backend/scripts 源排除；有限类型的传递闭包可能读取其它当前源，九个控制不等于整工作区恒同。

## 接受面与交接

三个旧私有模块路径退出，无兼容桥；函数名与完整运行算法保持。模块 URL、加载路径、栈位置和来源指纹改变是明确迁移影响。历史证据与 fingerprint 保留，不主张跨构建动作重放豁免。纯类型仍归原记录格式所有者，没有把 World／生产写方加入验证器。

十源已冻结，无 Git 提交，等待独立源码与中文语义审查后由 Root 按功能提交。此次结果不代表全 P7/P8 或剩余归档验证器已完成。详见[持久证据](generated/choice-effect-verifier-owners-evidence.json)。
