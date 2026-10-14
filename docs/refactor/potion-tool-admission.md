# 完整用药工具准入组合

实际基线 `198933bb2d06d2ef702c012be32bd6e851d67875`。原 Witch 私有 `validation_rules.ts` 的完整可写 `WITCH_VALIDATION_RULES` 和 `use_potion` 程序归 `rulesets/potion-tool-admission.ts`，profile 直接装配同一规则表。它拥有用药预检的首拒绝顺序，不保存库存或执行动作。

## 五路径与边界

五路径包括：新组合、Witch profile、Witch ports、新单元测试、删除的旧 validation 叶；实际存在候选是四个，旧路径没有转发桥。现行唯一生产 importer 是 Witch profile，另一个新 unit 直接检验该公开边界。

学者／导师削弱与魔术师映射通过其既有公开端口调用同一原函数；Witch ports 新公开既有纯双药谓词。完整能力选择、自救、库存、双药、有效目标与幸运／黑市目标限制都由这一具名组合保序组织，未只换两个查询 import。普通库存、frame／receipt、历史账本、付款和真实效果仍各归原 owner。

ToolValidationRuleRegistry／Catalog 不改，构造时原聚合索引和校验时晚读当前角色规则保留。规则表仍可写，不冻结或复制 map；角色没有专有规则时仍可由原全局工具索引处理受赠、复制和转移药剂，不增加 Witch 标签门槛。

## 读取和失败契约

- 原 callback 参数 destructuring 顺序完整保留。库存选择仍使用 `day ?? 1`，原幸运 none 必须指向自身，黑市 none 要求存活目标；普通 none 保留原接受。
- 救药先用原请求编号判断自救、库存及双药，再校验请求目标存活；此后才查询魔术师。映射仍用 `day ?? 0`，保留 `.isCurrent()` receiver，再晚读有效目标及生命／Role／WolfKillMark。请求编号与有效目标不能互换。
- 毒药削弱在库存与目标之前查询；原未结算错误直接传播。原 source／potionPolicy 和本地幸运历史不改，不把原生产品政策扩大到借赠资源。
- 准入不消费瓶数、mark、次数或历史，也不新增许可、库存快照、RNG、await、重试或错误恢复。

新增中文头及就地说明明确上述职责、动态库存、两个日期默认和首拒绝前缀；Witch ports 说明纯查询不扣瓶或关闭回合。四个真实首头检查、中文存在性分别为 0，488 个当时实际 Git 文档路径。没有全仓中文完成声明。

## 公开 API 和加载变化

旧 Witch 私有物理模块路径退休；常量名、表与 callback 在当前装配中的引用及可写性质保留。模块 URL、栈位置和当前构建 sourceHash 改变，不重写历史指纹，不承诺任意命名空间重赋值或私有反射行为等价。

移除三个真实无业务引用 binding：两个显式 type import，及已在原运行输出擦除的 unused `getWitchState`。不将它们当成已删除运行 getter。14 个保留 import binding 的实际声明端点相同；ToolRuleMap 现在显式标 type-only。

公开端口接线确实改变初始化图：以旧 owned 文件覆盖加现行共同依赖构造的有界静态值图为 109 → 116 模块，新进入图的是七个端口／生命周期／状态安装模块，没有新组合返回自身或 Witch profile 的路径。这个图不包含动态 require，也不是历史全图。没有把路径变更宣传成所有初始化副作用都相同，未修改门禁豁免。

## 有界验证与阶段

- 新 unit 首轮 2 pass／1 fail／26 assertions：第三例错误地把魔术师原 API 的 actorId／day 参数传反，在预期断言之前失败。保存完整原测试源码与首日志；仅改实际调用为 actor 2、day 1，失败例单独 1 pass／0 fail／5 assertions，原目标／用药上下文和预期不改，前两个绿例不重复。
- 原两个精准魔术师场景各一次：原他人救药可映射到女巫自身、原自刀不能绕过自救限制。实际 2 pass／0 fail／7 assertions，12 filtered。
- 合计 5 个不同成功用例、38 个断言，分三个执行；不宣称新三例首轮全部绿。
- 有限类型是四个现行候选加原 Magic 场景共五根，实际 session 92279 → terminal 476132，exit 0。删除叶不当作编译根；未运行全类型。
- 现行三生产程序仅逆 19 项明确路由／注释／unused binding 编辑，得到真实 Git 全文；完整 1,067 typed 节点及六份完整 ESNext／CJS 输出相同。实际完整 map 使用相同 const 包裹，503 typed 节点／580 非注释叶及两份输出相同，未恢复旧业务体。两个非首字段故意变更的负例被识别。
- 首证明 harness 将独立对象 initializer 当 SourceFile block 解析而失败；只加双方相同 const 包裹修工具，没有改产品。四个控制源字节保持。实际 1,704 个源的所有 literal 模块引用形态只有两个 canonical importer，旧路径零引用；不声称解析任意动态拼接路径。

同行末审校准新增测试两处说明：fixture 只切换 activation，source 保持原 native，首头相应改为当前实例目标策略；不声称该 fixture 已生成受赠来源。保存 prefinal 全文，经两处精确注释逆与完整非注释程序／两种运行输出桥接到最终源。原 runtime／类型／head 收据仍绑定 prefinal 源，没有重复已绿检查。末注释桥工具首次局部变量遮蔽失败亦单列保留，只修工具变量名。

未重跑全量测试、门禁、模型或完整玩法矩阵。Seer、Wolf 其它横向规则仍待各自职责迁移，本笔不完成全部 I04。

[最终范围](generated/potion-tool-admission-scope-final.json)、[证据与终态](generated/potion-tool-admission-evidence.json)、[完整程序证明](generated/potion-tool-admission-proof.json)和[绑定／有界静态图](generated/potion-tool-admission-bindings.json)均为持久交付，独立审查后由 Root 按功能提交。
