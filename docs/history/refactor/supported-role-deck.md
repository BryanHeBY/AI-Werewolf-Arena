# 支持校验与组牌

`rulesets/supported-role-deck.ts` 拥有原 bootstrap 中完整的有限支持校验和组牌程序。真实 bootstrap 调用它，不建立另一份未消费的计划。原 preset、道具组合、次数上限、胜利条件、角色组合、人数、身份设置与额外牌、固定牌 multiset 的拒绝顺序和错误保留。

owner 通过窄 readonly 元数据查询接收原 `getDefaultRoleCatalog` 和 `supportsWallRoles` 函数引用；catalog 工厂、profile 字段与阵营的重复读取仍在原位置。没有提前取得 catalog、复制 profile、冻结配置或把外部配置解析的错误顺序合进来。

应用仍拥有 World 创建、随机源选择、`fork("deal")`、实际 shuffled 和全部组件及 authority 初始化。固定牌仍按原分支复制，随机牌在原终点才抽取；支持拒绝之前不创建玩家实体。Thief/Shapeshifter 的两张额外村民保留原顺序。

八项新增、56 次断言和原固定牌用例一项、三次断言通过，有限类型检查退出 0。五种实际 bootstrap 原/现探针的全部 trace、组件顺序、原角色引用、错误身份和 RNG 保持；独立完整源码逆向、三个职责头及六次 cold entry 通过。最初类型注解与跨 SourceFile 打印 harness 的红证据保留，只修注解或 harness，生产程序未迎合它们修改。

本批完成支持校验与组牌的真实所有权边界；BoardConfig 冻结、RulePlan revision、checkpoint writer/reader 和完整 RulePlan 仍须后续闭合，存档形状未改。
