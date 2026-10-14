# 运行授权永久退休的夜能力与赠枪边界

前态为实际 Git `bd2e04894509f7777d2909632f768a3329e3b57a`。本批仅改 abilities、night-ability-grants、death-gun-lifecycle 三个生产 owner，新增一个专属单元；四个控制源是原 roleOf／emit 共用叶、原生 payload 准备、赠枪公共出口、原 F03 单元。Root 的 core／Initial 和其它作者的 Wild／原生枪／自爆接线是并行贡献，不属于本批 source 或完整不可变控制。

## 独立 F05a 行为

本次保留 Role.camp、构造器、Camp 组件及所有状态 schema。Root 的私有 WeakSet 只记录明确安装失败后永久退休的 Role 对象；恢复字段或跨 World 复用同对象不能恢复运行授权，正常阵营变化不自动退休。`isRoleExecutionRetired` 只提供拒绝条件，false 不表示已有行动许可。本批消费该唯一信号，不建立角色／阵营／库存镜像或第二集合。

夜能力 `activeNightAbility` 在原 find／status 完成后、返回前拒退休持有者。原 all／find／status、退休 ID、原生安装、启停 metadata、已付次数记录、借用撤销和死亡到期仍保持数据语义；裸实例、状态 active 或启用 metadata 不能代替执行资格。

授予预检仍先完成原复制／来源／状态／编号政策。原 bare source `roleOf` 在同一位置、同一次数捕获 sourceRole；私有预检返回 `{role, sourceRole}`。公开库存提交 `commitGrantedNightAbility` 新增必填尾参数 sourceRole，唯一实际调用点同步传入。两次 validate caller 分别用于授予和转移；新增数据引用不提供授权，也不额外查询 World 或加强正常换体政策。提交在原字典求值前及其 getter／空字典前缀后复验捕获双端，再安装、发表；发表失败不撤销已装资源。

转移原 `statePolicy`、黑市复验、资源保持及安装预检时点不变。F03 的完整原体／稳定库存预检后、源删除前复验角色退休；源删除和 ID push 后以及目标字典求值后、目标实例写前再次复验。中途退休会保已删除／登记 ID／空字典前缀，不退款、不补源、不改 disabled。源退休 ID 与 Role 执行退休是不同状态。

赠枪 private bind 接收原调用点已经捕获的 sourceRole，两个真实调用点传入，不增加 source World 查询。授予／转移在原条件、复制、绑定以及目标容器求值后的新写入点复验双端；失败保已建立 owner 证明或空字典，不安装新枪／推进计数。原先目标安装→删源→登记 ID→源事实→目标事实顺序不变。武装和 active 单独拒退休持有者。

## 已付提案与纯复验

`deathGunOwnerCurrent` 和完整 `captureDeathGun` 声明逐字保持，前者仍只核原 World／角色／来源／生命／库存，后者 `isCurrent` 不含墓碑。它们还被已经消费的 pendingGun 提案使用，不能因执行退休否定原体和已付结算。`isEligible` 仍经原 active 查询获得新执行拒绝。纯 all／find、firstDeath 捕获、finish 清理、consume 及 set-enabled metadata 完整保留；元数据不能使已退休身份重新执行。

这是明确拒绝行为，不是机械等价或全 55 专属权限收口。额外 guard 不提供事务隔离；任意强制反射写回、全局 built-in monkeypatch、回调中新建并行库存都不在有界唯一 owner 保证内。捕获 sourceRole 只描述本次对象退休读数，不宣称覆盖之后任意替换的 source 组件。

## 验证范围与来源

准备五个独立字面风险案例：夜能力授予双端退休与数据保留；policy 内双端退休拒转移；源删除后目标退休的前缀；已消费赠枪的纯 current／清理；赠枪双端及绑定 getter 的晚拒绝。只调用真实 World／资源命令和 Root 退休信号，不执行整局或模型，不重旧绿色。

检查前本批四源与 Root 首次全组17路径 fence 字节一致，`f82878 / 0`。新五案例首次 `9d2aa8 / 0`，5／0／76断言；有限四根类型 `c2bdef / session18045 → b89bd0 / 0`；四根中文头 `4b07f4 / 0`，当次690 Git文档。完整证明首次 `5dfdfb / 0`：三旧整程序、29精确编辑、6,010 typed nodes、6,921非注释语法叶、656 NodeArray；36原函数中25声明逐字保留，11执行函数明确改变，六份完整逆向ESNext／CJS输出相同。没有首红或绿色重复。新增行为的 actual JS 不同；完整逆和未改纯函数只证明编辑范围，不冒行为等价。

原Git前样固定bd2e，检查传递依赖是Root/Core/Initial、Wild/gun与self-destruct首fence完整候选，不是固定旧Git闭包。Root后继将首8c2a完整记录保存为 cohort-first-fence；本批引用仅改到该真实首路径。联合13生产与本批四源未变，末fence的两项foreign unit修订分别是Root this类型与Self微任务（后者在其自身首次检查前），不是末17路径一律同首。原检查、source及proof字节不改；首次元数据和该纯路径精度修正另存。原生与赠枪已付边界及五个新手写oracle另验；本批没有复跑任何旧测试／类型绿色或模型／全门禁。
