# C33 完整结构观察捕获归属

真实来源 `c946777b`；20 路径含 16 个旧消费者、删除旧 AI observation 模块、两个游戏侧 owner 和一个新单元测试。最终摘要、程序和双方向审查见 [固定证据](generated/player-observation-capture-owner-evidence.json)。

## 实际边界

`game/observation/player-observation-projector.ts` 完整持有原 buildObservation：可见死亡折叠、全部机制 ownState、身份、已知存活、队友、行动历史、能力／枪和原上下文裁剪。AI policy 真正调用此 owner，策略没有 World。

`game/observation/player-observation.ts` 唯一维护完整 PlayerObservation、ObservedPlayerStrategy 及原 clone／freeze 程序。SDK／ACP／生产 fallback／observed 策略与全部旧类型消费者直接引用 canonical；旧模块删除。既有 agents/index 公共 type 出口仅改指向，后续出口整理再收口。

## 数据与时点

29 处原 World 访问通过晚端口逐点保留；role／team 的 actor 参数通过 supplier 保原方法查找在前、actor getter 在后的次序。没有提前缓存 World 或 profile 方法。

已知存活是 roster 减已发表可见死亡，不是当前真实 Alive。队友保持原知识／RoleCatalog 政策，机制状态只显式投影，不复制完整 privateState。只删除 wall_id／death_action_id／debate_id；其它字段、nullable／optional 和返回键序保持。最终仍先 structuredClone，再按 Object.values 递归 freeze，不新增循环、Map 或 hostile Proxy 处理。

角色原文、人设、System／User 及当前目标许可提示仍按原时点执行，不把当前绑定 ability 的状态误作原生角色文案。

## 有限验收

- 原 observed 5 + Noble 14 + 新 3 首次实际 `22 pass / 0 fail / 80 assertions`。初类型红仅新 fixture 的两个字符串 ID 和 HookConfig 形状；合法输入修正后仅重新 3，实际 `3 pass / 0 fail / 23 assertions`。
- 最终严格有限类型 session `33541` 作者实际终态 `0`；关闭后误重复 poll 的 Unknown process 不当成新运行，也未重启。
- 21 完整程序／DTO／路由检查通过；16 consumer 的 ESNext／CJS 全 AST 同，15 非 policy 原程序 emitted raw 同。policy 展开仅 knownAlive 链折行 raw=false，原事实如实保留。
- 完整字段、类型、freeze、其余 System／User／custom 代码保持；精确调用／签名末逗号和 export 路由的证明修正逐项登记，未屏蔽字段、literal 或数组。
- 19 存在文件的中文职责头通过，重要知识／权限、晚读和冻结说明就地补充；Root 实读与两个独立方向最终 20 路径／原真实 Git 审查无待修项。

schema2、RNG、strict 构建准入及原规则均不改；新路径自动进入完整源码指纹。未执行全套、整局、网络或模型。

## 继续范围

完整结构观察捕获及 DTO 所有权已迁；当前许可／历史知识整体贡献、所有提示输入及 C36 角色展示仍待后续闭合，不据此标记整个 C33／P6 完成。
