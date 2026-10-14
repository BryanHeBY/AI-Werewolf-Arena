# 骑士白天结算组合

## 实际范围与职责

实际开工 Git 是 `7b202b1e35531eac47ea7f3bdc86667bf00a5961`；授权时前提交 `71eb5e37` 的三旧源码及四控制源逐 Git 字节相同。五源码：PhaseManager、新 `rulesets/knight-day-settlement.ts`、Knight ports、新定向单元、原 commit 纯中文注释。旧 commit 实现及所有旧测试入口继续有效，不造旧实现转发桥；ports 直接公开原函数同运行绑定。

完整原 PM 20 行 callback 的同步步骤归具名生成器。先 current，再 nightSettled 短路，然后原 commit callee→World→choice→Phase.Day→events；无提案立即 rejected。原本族 commit 保角色、库存、双方存活、目标真实阵营与资源 setter→事件→死亡提案原序。付款或发表失败不退还资源，也不标死。

付款和事实后才 `Object.create(null)` 并赋原 execution.phaseRevision。yield 只持 `{ duel, duelMetadata }` 两个原引用，不提前读 deaths／sources。PM 原 async callback 保唯一实际 DR await：先 DR callee，再读原 duel 字段和原参数／元数据；DR 失败不恢复生成器。成功后恢复原 current→经理封盘回调→endsDay 短路，日／终局／生命写仍归经理／DR。无提案路径不新增 await；没有新 Promise、许可、二份库存或通用 runner。

元数据无原型且仅有 execution，维持原决斗不带 nightEffects 的边界；接口只读类型不深冻结、不授权。新同步生成器、交接对象与模块出口是实际内部 API／加载布局变化。实际 PM `isCurrent` getter 只返回原词法 `dayIsCurrent` arrow，忽略新 runtime receiver；不承诺任意外来普通方法 this 与旧局部 bare-call 等价。checkResult 新方法在原恢复点才调用同 manager 方法，callee 与 checkpoint 读取仍保序。

## 完整源码与阶段证据

PM 完整程序四处精确正逆：4922 非 JSDoc 节点／6207 叶、两个完整映射输出。ports 两处正逆保持原程序，增加真实 commit 直接导出；owner 全九语句除唯一 yield 外，与当前 PM 原 DR await 拼回原 callback 完整包装程序，118 节点／152 叶与两个输出同。六实际 runtime 成员晚捕获、当前性原 arrow、两个运行绑定回到原物理实现均核。commit 三处中文说明与完整非注释程序／两 raw 输出同，没有改 setter、判断、字段或库存接受集合。

新三风险首次 3／0／38；原 `zh-CN/before_speeches: hitting Wolf King spends one duel, forbids its gun and stops before voting` 首次 1／0／8、15 filtered。两个执行、四个不同 case、46 断言，无成功复跑。新单元只观察同步交接与资源前缀，不模拟真实死亡；旧精准场景覆盖真实决斗命中狼王、消耗、禁止枪与投票中断。

Root 阅读后只增强新单元 oracle 首头“手写字面预期”一句，保存真实首绿色时源码全文，完整非注释程序及两 raw 输出桥同；输入、动作与断言未变，未重跑该绿色。此后五根有限 types `4b976a/session15877 → b5ce8d` 真退出 0，五职责头 `9f6961` 首次 0／618 Git 文档。完整证明 `c5ff1b` 首次退出 0，无失败根或额外门禁执行。Knight 原 state、window、DayPipeline 和原场景四控制源全 Git／当前字节同。

## 限制

不宣称整个加载图、任意私有反射／namespace 重绑定、全部骑士／特殊板子或 P9 验收已完成。本批不改生命规则、窗口准入、库存权限、原请求／网关、严格档案格式、指纹算法或历史身份；新增源码及路由按真实构建参与新来源指纹。固定前树结构检查不混此后工作树。

证据：[冻结范围](generated/knight-day-settlement-scope-final.json)、[完整程序](generated/knight-day-settlement-proof.json)、[收据](generated/knight-day-settlement-receipts.json)、[索引](generated/knight-day-settlement-evidence.json)。
