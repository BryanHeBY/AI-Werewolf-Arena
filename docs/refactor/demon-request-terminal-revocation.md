# 猎魔请求观察失效后的终态政策

## 精确范围与旧行为

实际迁移前态为 `7dd49c9942eed59897def06ec36b8af23ee83518`。仅修改 `demon_hunter/authority.ts`、`native_potion_requests.ts` 并新增专属单元测试；不改 core RequestLease、控制器、工厂、网关、参与者数据 codec、Ghost 或其他家族。

原行为由 Root 唯一执行的 `90fafa` 实际退出 0：两条真实 controller／factory／gateway 路径各六个独立合法 bootstrap 输入，12 个 fixture 均进入 provider、无 fixture 错误。原 stage、等值 context 换引用、领域 current 假值被正确观察后，恢复可重新查询有效；已接受最早期限被观察到期后，回拨时钟也恢复有效。两族随后均真实付款并只通知 `[true]`。错误 World／未知 clone 隔离正常；registered alias 自身 context 失配时原请求仍有效，alias 恢复也重新有效。这些是本批新增政策的前态证据，不称生产用户漏洞或旧套件失败。

`legacy-*` 按完整原字节保存原 20 份关键 Git 源文、855 份公开来源清单、临时探针、计划、结果与 raw；没有重跑旧探针或旧测试标题。原实验没有完整 NightPipeline／会话 Tape，hunt controller 本身不发表后继 stage chosen 事实，均保原限界。

## 原所有者中的终态

猎魔选择复用原 `night.turn`：仅已绑定且未付的共同正文、原 context、领域当前性或共享最早期限被观察失效，才永久清除这个原 turn。尚未绑定的查询不毒化后续绑定，旧 `opened` 仍阻止重开；不关闭整夜、不改原 choice、history 或来源许可。

原生 potion／Seer／Guard 都走 `native_potion_requests` 的同一绑定、查询、期限别名实现；实际两个原生 controller 和 ActionReception 消费同一公开绑定。共同 `Turn.revoked` 与别名 `Request.retired` 留在原记录，不建第二个表、库存或 shadow state。原领域→原正文／context／deadline→当前请求正文→共享时钟的有效路径读取次序保持；失效终态以后不再重新读取来授回权限。

未知对象和错误 World 在共同状态前早拒。registered alias 自身失配只永久退休该别名，仍保登记防止再次 inherit 复活，不关闭有效原请求；共享正文或领域失效仍撤共同许可。接受过的别名期限继续限制共同最早预算，不因 alias 自身退休而延长。

原安全快照、完整 JSON 正文、own-data／descriptor、深度与数组宽度仍沿本族原逻辑。RequestLease.window 的浅字段 pin 不能替代这些规则；叠用还会重复请求、预算和 completion，因此本批不扩通用 API。这里不是机械移动，实际 JavaScript 有意改变。

## 付款、错误和知识边界

查询只永久撤未付请求，不在查询中结算、退款或关闭整夜。捕获到错误先记对应共同或 alias 终态，再抛同一个 Error；控制器实际付款／finally 继续持有原 true／false 通知顺序。目标合法性和印记查询本身不新增墓碑，未知目标或纯数据读取不变成许可。

完整 `commitDemonHunt`、freeze、Witch／Seer／Guard frame、毒来源和审计程序保持原文。猎魔已经写入选择后 receipt 抛错，原 history／待冻结死亡提案保留；原生毒已付款后事实发表抛错，瓶数、audit、mark、一次 true 通知和封存来源保留。请求终态不撤回这些已付效果。

不推广 Animal／Fragrant／Noble 的 registered alias 共闭政策，不改变其他家族、公开 schema／机器协议／错误名或玩家知识；新构建自然产生新 sourceHash，严格档案身份及历史指纹不重写。

## 实际检查阶段

首次 source-ready 为 `f739d72dc151b5686f43f1199a700dbe6e65fdfa99bc7895a1ecde36a1b8c653`。Root 首新单元 `377ccc` 退出 0，16 个新政策用例、201 条断言；原 12 个观察输入没有重跑。实际 Seer／Guard 拒绝路径只注入被该 callee 消费的字段，其余 handler 端口未伪造；类型 cast 不是声称完整 NightPipeline 夹具。

Root 主证明 `71a28c` 首次退出 0：两个完整程序 63 个精确文字增量可完整正逆，18 个原付款／冻结／frame／查询函数保持全文，四份 inverse ESNext／CommonJS 整输出相同；四份 actual 输出均不同，明确不是旧运行算法等价。首职责头 `467fb3` 退出 0，3 根／739 份同 Git 文档／零诊断。

Root 首有限三根类型 `2c08cd`／session `5466` 至 `9574f0` 实际退出 2，仅新测试一条 TS2352，生产没有诊断。原执行 unit／ready／config／raw 均独立保存；后继只将 `input as NightStageContext` 改成 `input as unknown as NightStageContext`，字面输入、断言、流程和中文注释不改。最终 ready 为 `b260617f3d547ed258dd52f7552469b57f5a35ea428965e2a1829743238c53cc`。Root 只复查失败 unit 根 `f77821`／session `4531` 至 `d3be8d` 实际退出 0、空输出；不是第二次三根或全仓类型检查。单类型擦除桥 `f0aaf3` 退出 0，仅多一个 AsExpression／UnknownKeyword，两个完整 actual ESNext／CommonJS 输出同首执行 unit，另外两生产同原 SHA。首类型红原样保留，原 16 个绿用例、头和主证明没有重复。

作者没有执行检查；Root 仅运行本批必要有限检查。最终 C47 的完整同源验收另行固定，不因本批通过就宣称整个 F02、55 机制、通信矩阵或 P9 已完成。
