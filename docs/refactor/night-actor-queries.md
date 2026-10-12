# 夜间资格查询

## C24 首个切片

可写 abilities store 保留安装、库存、实例查找和 use accounting；跨机制的 actor 枚举归 `night-ability-actors.ts`。实际七个阶段使用 context 的窄查询端口。Nightmare 与 Scholar/Mentor 通过具体公共 port 提供已绑定状态的原资格判断，没有 generic callback registry 或第二个 World store。

查询只接 IDs、kind/day，roster 端口只提供 alive IDs 和实际 ability 读视图，不提供任意 World、writer、clock/RNG 或 receipt commit。只读不仅是外层数组：库存、state/history/tuple、source/suppression 字段都有读取类型。独立审查先证明旧接口的六种写入会编译通过，再确认同输入在新接口全部被拒绝。最终已选择的 actor 输出为既有 captured commit 保留同一个可写实例，在唯一输出边界恢复类型；不是 DTO、clone 或新 capability。

## 原有顺序与失败

完整 fear filter 先执行，再对剩余 actors 完整执行 Scholar guard/check filter，最后才读 Role、原排序实例及 status。没有合并为逐 actor 的两个判断，也没有 lazy enumeration 或资格缓存。原未绑定板子、撤销 roster、未 settled 和 target life 错误保持。

context 使用 readonly getter 连接真实 query。getter 在旧 `ctx.world` 参数求值处读取该字段，然后才求 currentDay；绑定本身不查 World 方法、actor/day。动态 context World 更换仍被观察。生产 previousExile clone 和原 world 字段捕获时点保持，未额外读取 pipeline.world。原三个基础阶段的 fixed-Git initializer 与新代码在同 getter/day 错误输入上均为 `[world, world, day]`。

Recipient 的独立枚举不接这两个 filters。Demon 替代执行、特殊原生来源、Radiant 借用、目标映射、Time Consort receipt、缺动作错误政策及 paid 效果仍保持原路径；本笔不宣称这些 C24 要求全部完成。

## 有限验证

新增七项、35 次断言；既有消费者五项、34 次断言；实际 Scholar/Mentor 同 Good 冲突周期一项、14 次断言通过。source compiler 与包含 12 个真实 context 构造者、新 query 测试及十个并行 split targets 的有限项目通过。只读输入修复后，只为该具体缺口重验同有限类型项目，运行代码的 ESNext/CommonJS 六项擦除比较全相同，没有重复整套测试。

独立 28 文件审查核对 24 个原程序的明确逆变换、store 14 个和 Witch 三个函数原正文、真实读取次序与同引用输出；28 职责头通过。六种输入写拒绝及两个 commit 输出写允许有独立编译反例。NightPipeline、Bootstrap、catalog、CLI 八个 fresh cold import 同成功、同出口；55 个 catalog 角色同序。

完整 RulePlan、贡献来源及工具 schema/动态 actor 一致性，其他 native/target/commit 政策仍继续后续切片。没有修改存档、RNG、角色/工具 ID 或黄金样例。
