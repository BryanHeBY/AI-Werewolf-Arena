# C07：事件与完整请求的数据契约

事实依赖迁完后，完整 EventPayloadMap、GameEvent、投票/查验反馈 DTO、PlayerVisibleEvent 与 ActionRequest/Context/Extras 归纯契约。事件仍按原 type 区分 payload，并对原私有事件要求只读历史 audience；投影入口的开放 Record 形状没有被偷偷强化。

独立审查与 `dbb47a1` 核对：11 个事件声明、148 个直接 payload 成员及 3 个贡献 map、50 个可选请求 extras 和 4 个必填 context 字段保留。唯一字段内类型路径改变是 Cupid 关系改用同包纯 DTO。请求 deadline 仍可选，原数组的可变性不变。

ActionProvider 执行端口及 Knight/SelfDestruct 领域选择留在领域。工厂、实际 envelope 身份、WeakMap、完成回调与作用域没有进入包。数据接口不解析 unknown，也不授予行动或写入权限。

请求工厂和事件记录器已直接消费公开契约；两者非 import 正文逐字保持。前端覆盖测试只读公共事件贡献位置，原双语完整集合与 3 个用例保留。

4 个包内公开/type 反例测试、11 个断言通过；契约源与测试、backend 源码类型检查通过；前端原覆盖 3/0/545。其它阶段流程和严格复现的集中门禁继续在大阶段执行。旧 core/model 等具名出口已登记 C44 清除，不能作为长期第二定义源。
