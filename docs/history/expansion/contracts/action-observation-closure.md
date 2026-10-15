# 行动授权与玩家DTO契约

行动的提交、合法接受与实际生效是不同事实。保留现有World/body/life/day/phase/角色私有状态/能力实例绑定；非法或过期提交不消费资源，合法提交后效果按既有死亡前缀规则保留。不得通过维护改变玩法。

## 异步边界

- 请求前验证当前scope，避免已撤权对象仍收到秘密上下文或模型请求。
- 每次await后及实际提交前再验证scope；阶段结束、生命变化、实例/资源/来源撤换不能借旧回合权限。
- 使用共同scope helper表达可复用约束，保留机械模式、觉醒激活和付费赠予的特殊政策；不把所有调用机械替换为一套较弱检查。
- 死亡行动仅由DeathResolution授权，绑定确切能力实例并及时关闭；库存与pass/invalid语义保持当前契约。

证据：`backend/src/game/mechanisms/roles/ability_scope.ts`、`death_abilities.ts`、`ability_changes.ts`及`game/engine/death_resolution.ts`。摄梦请求前撤权已修复；女巫补全能力元数据绑定，守卫/预言家/女巫绑定确切夜晚，摄梦/守卫/预言家在构造请求后复核。回归证明已撤权对象不进入provider、不提交或耗费资源，并保留此前已接受前缀。

## 玩家信息

玩家DTO和ownState明确逐字段白名单，包含玩家已获知的语义事实；不直接序列化raw privateState/能力对象，不执行未知getter，不用类型断言替代梦history等结构校验。God录制可保存完整可序列化语义事实，排除运行引用和认证。

狼队历史事件按发生时audience授权；当前阵营不自动补发历史。查验展示标签与真实角色/阵营独立，学习和胜利归属保持其原口径。

## 工具协议与兼容

机器工具名/schema与面向人的描述/提示分别维护；中英描述来自显式locale，不修改稳定enum/key/参数类型。旧tool_specs或contributor只有确认无消费者、检查包导出/测试及兼容用途后可移除；活动迁移parser保留在独立路径。原始名字、人设、发言不自动翻译。

回归覆盖请求前撤权、await中撤权、原生命死亡/复活、资源耗尽、来源撤换、DTO未知字段/非法history、双语工具schema等价及特殊实例授权。

## 机器schema收口（main继续实施）

旧ToolSpec.llm描述包装和gatewaySchema副本已移除。ActionReception直接消费ToolSpec.parameters；48个规格贡献的type/enum/required/additionalProperties等机器约束与旧值完全相同，只删除description注释。活动SDK/ACP统一协议与共享locale提示保持原接口。四旧角色26条、通用/警长23条独立中文描述同时退出源码例外表；getLlmSchema、无消费者getMany及旧gateway schema注册/查询去除。机器工具名及argHint不变。

新增实际preflight回归为旧llm/gatewaySchema放置抛错getter：合法数字字符串仍归一化，错误布尔/额外字段仍拒绝，不读取旧metadata也不修改World。其他legacy contributor/角色视图清理在独立切片继续，不能把本切片宣称全部prompt与规则配置完成。

## Legacy派生视图清理

没有源码/测试调用且仅在原文件声明的三个legacy contributor（roles、witch、win_conditions）已移除。RoleViewRegistry连同barrel导出去除；实际前端/录制继续使用共享稳定角色ID。RoleSpecRegistry此前仅由createDefaultRoleRegistry装配权限，其label/skillBrief派生字段无人读取；改为roles/permissions直接遍历RoleCatalog，保留createDefaultRoleRegistry函数名，消除RoleSpec与重复文本。23个角色的权限列表与旧值完全一致。

WinConditionSpec无人读取的description及三条内置中文副本去除，真实evaluate/checkpoints不变。仍有实际消费者的RoleCatalog.label/skillBrief、profile.renderPrompt、自定义profile文本，以及TextLocalizationRegistry保留；四个历史中文phase识别和“中文”语言名是剩余5项源码例外，不是旧生成prompt。独立schema/API清理不改变已记录机器协议或默认玩法，内部源码指纹按正常规则更新。
