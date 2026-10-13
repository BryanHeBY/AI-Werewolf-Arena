# 夜间能力的读取与写入边界

## 读取实际存储，写入归具体 owner

`allNightAbilities`、`findNightAbility`、`activeNightAbility` 和夜间 actor 查询输出同一原能力实例的 `NightAbilityReadView`。能力元数据、来源、抑制标记和七种实际 payload 使用有限只读形状；历史数组、行和查验结果一并只读。查询不复制、冻结或重新验证已存储的能力。`all` 仍按原规则创建和排序自己的结果数组，实例保持原引用。

原生安装及 grant 的返回值也只读，避免绕过 getter 重新拿到可写的 live 状态。安装输入和独立复制／转移的 state-policy 数据保留原写契约与复制规则。四个普通 payload getter 复用对应 feature 的只读声明；Seer 继续使用已有深只读声明。Pair、Shelter、source 和 suppression 只覆盖其实际字段，不添加假想状态。

原能力 owner 保留开始日、使用日、次数、启停和死亡失效的具体命令。Witch、Guard、Dreamer 和 RoleInspection 的 payload 写入仍在原 owner；调用者继续持有原授权检查、付款、效果和公告顺序。Eclipse 的 close 命令保留原标记／实例当前性检查，输出标记只读。没有任意字段 setter 或通用可写角色接口。

Pure White 的原三条写入由 RoleInspection 的具体命令承接：三次 `ability.state` 读取、lastTarget、lastDay 与一次复制结果的 history append 保持。它与接收捕获 state 的普通命令分别表达；不追加第二份历史，不重查许可或回滚已有写入。Demon 的封印原生库存、描述符与 JSON 检查继续独立拥有原写入。

## 真实消费者和测试输入

消费者迁移覆盖实际查询、getter、scope、policy、stage、frame、projection 和初始化引用，不能仅靠编译错误找齐。TypeScript 允许某些只读标量对象赋给可写结构；普通读取者的显式参数类型也必须收为只读，不能在阶段函数内部重新开放整个能力写面。

既有测试的状态造数与恶意变更继续执行原表达式，只增加明确的测试类型适配。没有使用生产 setter 清洗输入或修改期望。新增编译负例使用真实合法字段；同槽／安装复制、actor 查询与具体命令的读取／失败前缀由局部用例核对。完整原程序、原记录控制及最终进程结果按本批实际范围记录；全量门禁留到阶段汇合。

本批实际修改 30 个生产文件、37 个既有测试和 1 个新单元文件。四个新用例通过，共 19 次断言；完整源码／测试类型项目以及最后 68 文件有限检查均实际退出 0。68 个职责头通过，没有新增依赖失败，14 条历史债务保留。原测试包含 136 处窄字段／history 类型适配；两处 matcher 泛型及一处同变量 grant 输入断言保留原输入和预期。[证据摘要](generated/night-ability-read-evidence.json) 记录各文件指纹、两个编译范围及原程序逆映射的精确格式／语法例外；不声称全部原字节或导入初始化顺序相同。

## 剩余范围

本批关闭七种夜间能力的普通读取和已有写入消费者边界。全部角色私有状态、原体／租约、schema 与完整编码、custom profile 扩展贡献、核心容器的最终 opaque 表面、能力共同生命周期及旧出口退出继续按矩阵迁移。静态只读类型不授予或撤销运行时行动许可，也不能据此宣布 P3 或 P6 完成。
