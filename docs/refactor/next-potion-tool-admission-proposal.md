# I04 下一笔建议：用药工具准入组合

只读研究，实际观测基线为 `7d61cda46985ad7d6e2001d13992d7c3e310de7e`。未编辑产品、未运行类型／行为／全量门禁，未更新机制矩阵。

## 当前仍有的业务边

| 实际入口 | 跨族业务 | 原位置／次序 |
| --- | --- | --- |
| `roles/seer/profile.ts:64–84` | `scholarMentorBlocks` 直接来自学者／导师私有 `night_frame` | 活跃查验实例 → 夜间 → 工具名 → 学者削弱 → 存活目标 → 查验政策 → 幸运目标历史 |
| `roles/witch/validation_rules.ts:22–100` | 学者毒削弱及魔术师有效目标映射，直接来自两个私有 `night_frame` | 完整用药预检中分别位于毒库存之前、救药请求目标通过之后 |
| `roles/wolf/validation_rules.ts:28–32,60` | `weddingSetup`、`canSubmitWeddingTool`、`ghostBrideReady`、`weddingMember` 直接来自新娘 authority | 婚约刀分支先于普通狼刀权限／phase／tool／pass；自爆婚约排除先于普通自爆能力 |

普通狼还有 `wolf_team.ts` 的婚约／师徒／动物／梦魇政策组合，以及共享普通狼特权 mock 对迷雾目标圈的查询。仅把 Wolf validation 的几个查询改成端口，不能声称这些业务依赖已全部消除。已交付的普通狼贡献共享、狼刀目标组合、actor 查询、状态槽及阶段 `native-night-target-policy` 也不重复迁移。

现行矩阵仍将 Seer／Witch 的 native／target／failure 政策列为未完要求；其中 actor 查询及若干状态／效果的 `partial` 不代表上述工具准入组合已经交付。矩阵观测提交较早，本研究以当前实际源码为准，不据旧台账扩展验收。

## 建议选择

先完整迁移 **`WITCH_VALIDATION_RULES` 的 `use_potion` 预检程序与唯一可写规则映射**，到具名 `backend/src/rulesets/potion-tool-admission.ts`。这是一笔实际工具准入组合：拥有能力选择、药剂类型分派、自救／库存／双药检查、学者毒阻断、魔术师救药映射和目标限制的原首拒绝顺序；不是导出一组万能查询或包装 `scholarMentorBlocks`。

五个源码路径：

1. 新 `rulesets/potion-tool-admission.ts`：完整原映射与 callback，保留既有常量名 `WITCH_VALIDATION_RULES`、可写对象及函数引用。
2. `roles/witch/profile.ts`：只将实际规则映射导入改为该规则组合，原 metadata／runtime／presentation、配置、初始化和 mock 全保。
3. `roles/witch/ports.ts`：实际公开既有纯 `nativePotionsCanCombine` 查询，供规则组合使用；函数绑定不替换，不授予付款或第二回合提交权。
4. 删除 `roles/witch/validation_rules.ts`：目前唯一实际 import 是 Witch profile，未发现其它公开／测试消费，不保旧路径出口桥。
5. 新增一个定向 unit：检验当前规则替换、getter／拒绝前缀和无资源写入的实际新边界。

新组合从学者／导师和魔术师已有公开端口读取原函数，普通药剂库存仍是 `abilities`／Witch state-slot 中的同一实例，学者 settled frame 与魔术师 receipt 仍各归原族权威。`ToolValidationRuleRegistry`、Catalog 和 gateway 不改；不引入装饰器、插件注册框架或新状态。

先只做这笔用药组合，可以实际消除 Witch 对两种板子私有实现的直接业务依赖。Seer 完整 `check_identity` 准入和 Wolf 婚约／普通刀／自爆组合另有职责范围，后续按真实程序迁移；本笔不声称全部 I04 收口。

## 动态能力与 API 时点

- `ToolValidationRuleRegistry` 构造先按 `allRuntime()` 和 `Object.assign` 建索引，校验时仍现场读取 `catalog.runtime(ctx.role.role)?.validationRules?.[tool]`，最后才回退已索引规则。不能提前缓存新表、冻结表、改 registry 或覆盖用户 custom profile。
- 缺少该角色工具规则时，收到／复制／转移的 potion 能力可通过全局原工具索引走这份程序；不能新增 `role === Witch` 门槛。`activeNightAbility` 的 id、disabled、到期、次数与同日第二药检查仍按原实际库存读取。
- callback 原参数 destructuring 顺序是 `world → actorId → role → toolCall → day → abilityId → phase`。直接调用这份原公开 callback 时也可能有访问器，不把参数改成早 snapshot 或额外上下文 thunk。
- 原药剂组合谓词只按现有 source／policy 判断，不能新增 source.role 限制。原普通瓶、受赠／复制／转移／幸运／黑市实例与猎魔封存库存差异均保留；准入不等于付款或提交。
- 旧物理模块路径明确退休，函数／常量名及运行贡献表引用保持；模块 URL、栈位置、sourceHash 与新增装配边是有意边界变化，不宣称任意反射 API 等价。

## 必须保留的原轨迹

1. 找不到活跃能力先拒绝，随后 phase／工具名；幸运 none 必须指向自身，黑市 none 要求目标存活，普通 none 保留原接受，不补目标限制。
2. Heal：原请求编号先参与自救检查；自救在库存之前、库存在双药之前；原请求目标存活之后才 `isMagicianBoard(world)`。有板子时 callee 后读取 `world, day ?? 0, requestedId`，保持 `mapping.isCurrent()` 的方法 receiver 与抛错；不把 day 默认改成 1。
3. 通过映射 current 后才读取 `effectiveId`；有效目标存活、Role、StatusMarks、`.has(WolfKillMark)` 按原短路读取。不能把原请求编号改成映射目标来执行自救，也不能以只读 receipt 代替实际许可。
4. Poison：`scholarMentorBlocks(world, day ?? 1, actorId, "poison")` 在毒库存检查之前；它可能抛原未结算错误，不能 catch 成普通拒绝或提前读取目标／瓶数。原 `luckyTargetAllowed` 的本地历史、过期／转移影响及目标重复限制完整保持。
5. 全部预检不写库存、mark、使用次数、事实或历史；任何 getter／frame 失败保留第一失败和已经发生的读取前缀，不新增重试、当前性检查、await 或 RNG。

## 定向验证与中文维护

新 unit 建议覆盖三点：canonical 规则表与 profile 同引用且 registry 构造后仍读当前可写规则；访问器上下文／映射失败保持晚查询和无库存写入；幸运／黑市 none 的原不同拒绝轨迹。预期用手写字面与真实组件／frame，不复制生产校验算法来生成 oracle。

原用例只挑必要风险各一次：

- `scenarios/interactions/magician/original-target-mapping.test.ts` 的 `Magician allows an original other-player heal to land on the Witch herself` 与 `Magician rejects healing an original self knife before spending a potion`。
- 若新增直接 map 测试未覆盖受赠差异，再挑 `unit/features/witch/native-policy-resource-boundaries.test.ts` 的 `gift: native two-potion and always-disclose policies cannot widen a foreign resource`；不重跑整张矩阵。

保存真实最新 Git before 与这五路径源码／删除 SHA；现行完整 map 和 profile 精确 binding 逆对照全部字面、分支、getter、字段及原错误，不能替换整 body 求证明。有限实际值图核新组合经端口／state-slot／abilities 是否返回 profile、Catalog、registry 或其自身；若有冷加载环，真实断开装配，不新增 gate 豁免。后端受影响根有限类型一次，失败根修正检查即可；不全仓门禁或整局。

新 owner 及触及端口／profile 用准确中文职责头，补就地说明：预检不付款、请求编号与有效目标区别、不同 day 默认、削弱首拒绝和资源族边界。数据／逻辑注释说明真实读取与写权，不只描述文件名；原机器标识、错误、用户文案和测试标题不翻译。真实职责头检查与中文存在性分开记录，三方面交叉审查分别核资源／组合规则、getter／失败轨迹、公开 API／静态加载。
