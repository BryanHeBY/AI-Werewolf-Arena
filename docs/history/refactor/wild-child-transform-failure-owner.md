# 野孩子转换失败后的绑定撤权

基线为实际提交 `c9adfd3104527fcaceedcd4d170ed7304065aa4c`。本批只有原 `wild_child/lifecycle.ts` 与一个新风险单元；不删除 `Role.camp`，没有将现行阵营消费者切为单一 Camp 来源。

## 政策与完整顺序

本族私有 `WeakSet<WildChildBinding>` 只记录转换核心失败后的永久撤权，不保存阵营镜像，不修改公开绑定、状态 DTO 或档案。统一身份复验在原绑定身份检查之后核失败标记；恢复原字段或组件引用不会复活已失败的本族 owner。原组件、descriptor、生命、JSON 与宽接受规则保持，未新增绑定必须可写的前检。

榜样首死的 `modelCommitted` 和 `model_eliminated` 事实仍先发生。原资格及可写检查通过后，转换核心的九个实际语句保持：准备 Camp／Victory → 写 Role.camp → 安装 Camp → 安装 Victory → 更新捕获阵营、组件引用与 Victory 内容证据 → 更新转换槽与 expectedState。核心抛错先将绑定记入失败集合，再传播同一错误；已完成的写入、选择库存与死亡事实不回滚。

| 失败位置 | 已完成前缀与后续本族资格 |
| --- | --- |
| Camp 安装失败 | Role.camp 已 Wolf；原 Camp、Victory 仍 Good，槽仍 chosen。保这些前缀，本族 owner 永退。 |
| Camp 已安装，Victory 晚失败 | 实际 Camp 已 Wolf；旧 Victory／部分捕获字段保原前缀，本族 owner 永退。 |
| 完整核心后的 transformed 事实失败 | Camp、Victory、绑定、槽与 expectedState 已提交；原错误传播，保本族资格及下一夜激活。 |

事实发表保持在 core try 之后。榜样事实在 core 之前抛错、资格普通返回 false、编码器原本返回 `invalid` 的分支，均没有被改造成新的 core 异常。Initial 的身份／实体牌／Camp／Victory 安装顺序和 F02 结算完全不动，作为完整字节控制。

## 静态发现与收据阶段

首稿把失败标记放在公开绑定属性：新三例首次通过（`1ab2be`，3/0/45），两根类型实际 0（`e7f03d`／79614 → `c3023a`），两头首次 0（`c00f9c`）。Root 随后静态发现：若在 Camp 安装调用内冻结绑定再抛错，catch 属性写会遮盖原错误。入口前就冻结会先在原 `modelCommitted` 写点失败，不能作为该 catch 反例；文档与新输入据实际顺序校准，没有声称首稿已执行红测试。

改为私有 WeakSet 后，仅新增冻结输入运行一次（`b7b85a`，1/0/8，前三例 filtered），同 Error 与永久撤权成立。首三例全文保持，未复跑。两处实际改动根的后继类型检查 0（`e1e8d2`／88309 → `f48085`）；未重跑原职责头。总计四个不同风险用例、53 次执行断言，分属两个明确源码阶段；不声称首三例已在末 WeakSet 版本重新执行。

唯一最终完整对照 `06db28` 退出 0：四项精确编辑完整正逆恢复原 lifecycle；九个核心语句、21 个完整保留函数体保持，累计 2418 个 typed AST 节点／1266 个 AST 叶比较。ES 与 CJS 各核完整逆向程序和 core 输出相同（四个输出对照）；实际完整 JS 因 F04 新政策不同。首属性稿的完整源与五项原编辑、末五项存储差分另存，未伪装为纯注释或类型擦除。Scoped diff-check `9f32d6` 退出 0。

## 边界

不重复历史 `9c0b47` 现状实验，不运行 Initial 旧失败、全门禁、完整对局或模型。新单元使用真实 canonical setup，再直接调用本族首死提交与死亡贡献，没有运行中央死亡波；安装／发表异常由测试自己的实例注入。

后续 Camp sole-source 批必须单独声明现场读数与旧 Role.camp 可写／无 World 接口退休。原严格 Camp 引用族与纯值族的同值替换政策没有统一。本批只撤销 Wild 生命周期资格；common 赠予能力等其它 owner 未被全体撤权或改造。私有 WeakSet 新增模块内初始化及 has/add 读点是明确变化，不泛称任意内建 monkeypatch／冷初始化图等价。不新增格式或版本，源码身份按真实新字节生成，历史档案身份不改写。
