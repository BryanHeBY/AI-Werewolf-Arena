# C30 普通夜能力实例写权收口

固定 actual Git `99fac061ac8842dde89abe02c2a33648ea10859b`。最终37路径冻结：19生产源码（2owner+17实际consumer）、17原测试/support、1新单元测试。精确SHA及34进口见 [固定证据](generated/night-instance-metadata-owner-evidence.json)。

## 真正所有权

将 `installNativeAbility`、`setNightAbilityStartDay`、`recordNightAbilityUse` 原完整声明迁到已有 `ability_changes.ts`。这使原生/受赠/copy安装、start day、use/enable/death expiry/transfer/retire公共metadata同归现有owner；具体瓶数、历史与已付效果仍归各机制。未建立新Store或泛型枪/夜能力框架。

查询文件仍拥有live类型、status/find/active、数据copy和玩家projection，三个旧写出口直接退出，沒有forward bridge。现有纯 `projectPairState` 原body仅具名export供native初始化与projection共用。changes→query单向，query不反import changes。

34真实caller仅改named imports；各函数、this、`ctx.currentDay()`参数位置、World／target getter、付款／回调／事件顺序不动。

## 有限验收

- 原3搬迁声明逐字一致；36 actual Git 来源与完整非import runtime程序的明确注册迁移逆向均同；37中文职责头0。
- 新3 bounded/0/15assertions：同实例读引用、复制、start/use、increment失败保前写、Pair guard先于clone。
- 原安装/transfer两项2/0/12，Pair getter拒绝1/0/3，native Witch/Lucky独立瓶数1/0/8。
- 初有限83811仅新Bun matcher null flow narrowing；只补expected泛型，修后24087实际终态exit0。原红保留，没有放宽类型或改测试input/expectation。
- 37拥有路径formatter0，源码/矩阵grammar仍同；注释、格式及expected类型擦除后没有重复runtime／compiler。

C30生命周期API职责已在本普通能力族闭合；借用租约、赠枪专有first-death/arm和各payload规则保持独立，本批不宣称统一所有能力政策。未动engine、intent、schema2、CP、golden、RNG或clock，未跑完整对局／全suite／模型网络。

## 交叉审查与语法说明

Root 核对实际两 owner、三完整写者、调用边界和新字面用例；独立审查核对 36 真实 Git 原文、34 迁移／41 具体绑定、37 SHA 和中文职责，均无阻断。四个已迁 intent caller 的格式化增加特定调用／metadata 对象的末尾逗号；最初两次证明红保留，最终直接 AST token 比较只处理这些明确节点，不屏蔽数组、字段、值或任意函数。生产程序没有为证明而修改。新增与触及说明用中文，解释原生资格先于 clone、公共 metadata 写权及使用失败前缀。
