# 四族原生／学习死亡枪的完整资源与结算 owner

实际基线 `34239c73a92b2e59ed8c3499cf708fd51869a5e7`。本批 20 个源码路径＝18 现行＋2 删除，覆盖 Hunter、WolfKing、Mechanical、Awakened 的原生／学习枪；赠枪及其他学习技能不改。初始保存19个真实Git旧源；其中机械ports、觉醒ports、猎魔重ports三源最终原字节不动，改列稳定control，总7个控制。临时23路径盘点不当成23个修改源。

## 完整所有权

`native-death-gun-resources.ts` 真正持有普通两族的完整创建、原get／install、学习枪新模板、两族完整武装条件、两套每hook捕获表／所有元数据复验、stock命令捕获和原消费算法。原学习对象的整体JSON复制／安装仍在各族state，保持同一次copy及原mimicClosedDay写点；不再复制枪或建立第二store。猎魔审计枪的付款仍唯一由原authority回执执行，本owner只在原点捕获并消费它。

`native-death-shot-settlement.ts` 持有完整原resolver循环：原角色／state／已死生命→stock→死因→政策／来源身份→选择await→current／stock／原体复验→invalid／pass／mapping／保护→付款与追加提案／延期事实。标死、波次、死亡权限和终局仍原owner。两个旧native state文件及旧`death_shot.resolveDeathShots`物理／符号入口退休无桥；death_shot只留原工具、修复和预检。四个实际hook／profile直接用新结算。

普通两族get仍裸读privateState字段，可执行原getter；安装保原值、原引用和可写性，不增加schema／descriptor／Proxy拒绝。初始化先求原set callee／角色参数，再调用新的create并逐次读取原配置；进入set之后才读privateState左值。机械枪ready夜与觉醒枪激活时点分别保留；后者仍先arm，再原activationNight／activeFromNight更新。其它学习资源、copy／borrow／transfer与赠枪独立政策不夹改。

## 捕获、失败与调用边界

Mechanical每hook新Map只核原state／learning／gun；Awakened另核原targetId、role、day、activationNight、activeFromNight，读取次序不统一。getState通过晚getter取原函数并裸调用，未缓存可替换的callee。Demon独立`native-gun-ports.ts`只直接公开原stock函数，避免从重ports增加药请求／印记初始化；authority全文不动。

stock在原Role／State／Alivefalse检查后、sources之前捕获；await后current短路在stock.current之前，stock撤权仍抛原错误，随后才核currentRole等。Poison／不许可即使原canShootfalse也照原消费；普通setter抛错不读后续字段。命中先付款，再查保护；miss、blocked和事实发表失败均不退款。pending.current沿原宽度保留，不添加stock／canShoot复验或新的终态政策。

创建helper新增callee与调用栈；readGun arrow从rules对象构造点移到hook入口，原Map仍在hook入口创建，新增queries对象／closure是明确API布局变化。原native私有路径和resolver出口退休，新接口只能作为可信运行组合，不能写入request context、MCP或档案当凭据。普通贡献对象和资源仍可写，不承诺CJS namespace任意重绑定、任意外来rules/getter或全冷初始化图恒同。新增模块／注释进入真实新sourceHash，历史指纹和严格复现政策不改。

## 一次有限验证和保留的红

- 新4个独立字面边界：重复配置读取／同ref安装；每hook学习捕获与不同元数据；受控stock-before-sources和stock撤权优先；付款后保护getter失败。首次4／0／28。stock用受控回执，不冒真实Demon审计付账覆盖。新测试首次运行后还迁了两族完整arm条件，原体由完整proof核同，并在随后旧机械精准例真实执行；未重跑四个绿例。
- 原狼王zh-CN完整cause-table精准例1／0／96，9filtered；原机械camp撤权精准例1／0／4，3filtered。共6不同用例、128断言，三次运行，不重复绿色输入。
- 首18类型根真实exit2：本批两个alias＋5测试typing诊断，另并行B setup两项。只修类型；仅2失败根收尾仍因测试callback漏undefined一项exit2；仅该unit根终态exit0。原生产无runtime修正，两全程序4emit与末unit2emit擦除相同；B外来根由其作者独立闭合。
- 唯一完整proof真实exit0：11实际算法、17既有完整程序（含3未改控制）、34整程序逆输出、28,870 typed比较。native4声明8raw输出同；完整新resolver用已验证的stock／consume体展开后，与原全部语句／完整typed AST（含叶文本与NodeArray）及两raw输出同。没有拿恢复整个旧loop代替审新owner。当前静态值图72模块／113边，新两个owner及轻facet无返回环；不是冷执行／全传递图字节恒定。
- 首18职责头／634Git文档有3真红，仅两学习hook缺时点／权限；补两句实际中文后只2失败头复查exit0。末两头＋unit类型的6全emit桥承接原proof/type/runtime源码阶段，不重绿色检查。分组命令保bridge完成JSON/log，独立exit未另捕获，不虚构收据。

这是四族枪资源与完整结算职责，不是所有学习技能、全55机制C17/schema／档案codec或P9完成。未运行全量门禁、整局、模型、浏览器或修改golden／矩阵／进度。Root共同两domain测试只精确路由和12条原ts-expect-error解释中文化，机器directive与全部assert不变。

[范围](generated/native-learned-death-guns-scope-final.json) · [证据](generated/native-learned-death-guns-evidence.json) · [真实收据](generated/native-learned-death-guns-receipts.json)
