# 行动授权与玩家DTO契约

行动的提交、合法接受与实际生效是不同事实。保留现有World/body/life/day/phase/角色私有状态/能力实例绑定；非法或过期提交不消费资源，合法提交后效果按既有死亡前缀规则保留。不得通过维护改变玩法。

## 异步边界

- 请求前验证当前scope，避免已撤权对象仍收到秘密上下文或模型请求。
- 每次await后及实际提交前再验证scope；阶段结束、生命变化、实例/资源/来源撤换不能借旧回合权限。
- 使用共同scope helper表达可复用约束，保留机械模式、觉醒激活和付费赠予的特殊政策；不把所有调用机械替换为一套较弱检查。
- 死亡行动仅由DeathResolution授权，绑定确切能力实例并及时关闭；库存与pass/invalid语义保持当前契约。

证据：`backend/src/game/mechanisms/roles/ability_scope.ts`、`death_abilities.ts`、`ability_changes.ts`及`game/engine/death_resolution.ts`。摄梦请求前撤权是待实现前复核项；回归应证明没有发生请求和提交，而非仅检查最终存活状态。

## 玩家信息

玩家DTO和ownState明确逐字段白名单，包含玩家已获知的语义事实；不直接序列化raw privateState/能力对象，不执行未知getter，不用类型断言替代梦history等结构校验。God录制可保存完整可序列化语义事实，排除运行引用和认证。

狼队历史事件按发生时audience授权；当前阵营不自动补发历史。查验展示标签与真实角色/阵营独立，学习和胜利归属保持其原口径。

## 工具协议与兼容

机器工具名/schema与面向人的描述/提示分别维护；中英描述来自显式locale，不修改稳定enum/key/参数类型。旧tool_specs或contributor只有确认无消费者、检查包导出/测试及兼容用途后可移除；活动迁移parser保留在独立路径。原始名字、人设、发言不自动翻译。

回归覆盖请求前撤权、await中撤权、原生命死亡/复活、资源耗尽、来源撤换、DTO未知字段/非法history、双语工具schema等价及特殊实例授权。
