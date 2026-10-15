# 增加或修改一个机制

## 先冻结规则与范围

1. 查[规则索引](../rules/README.md)是否已有相同source／版本。明确有限板子、默认、目标、资源、时钟、死亡／到期、已知信息、胜负及不支持变体；不从角色名字或试玩经验补规则。
2. 区分纯迁移与行为政策。若要修授权／付款／取消，先保存真实旧输入characterization，不用先改oracle让新实现显得等价。
3. 找真实producer→consumer。没有共同不变量时保本族owner；不要先建base class／通用framework／role switch／第二WeakMap镜像。

## 放到唯一职责

- 一个机制可服务多个角色，放`features/<feature>`；不要一角色一个workspace或复制多份算法。
- state持实际容器／schema／编码及原写权；profile只声明与接入，init完整安装委托真实state owner而非再包公开getter。
- window持真实request／await／付款／completion；frame持时点捕获，life／版本／来源与paid current按本族规则。
- rulesets显式贡献支持闭包、顺序、替换与冲突；PM／DR保真实时序／波次／唯一提交，不加逐Role分支绕开贡献。
- 公共inert facts／动作／事件类型进game-contract；纯展示进game-presentation／game-text；观察贡献不能暴露raw私有容器或授权句柄。
- checkpoint capture与独立verifier分开；后者放`recording/verification/<feature>`，不能import生产规则作oracle。

## 写下必要边界

接口就地说明原引用、可写字段、getter／Proxy接受、短路与callee／参数顺序；说明首语义写／付款、后续失败prefix、paid与未付、关闭／幂等／取消。

维护文件头、接口和重要逻辑时使用中文注释。文件头交代职责、输入输出与资源归属；数据结构说明字段约束、原引用或副本、可写范围和生命周期；关键逻辑解释执行顺序、异常前缀及容易误改的不变量。注释与实现一同维护，避免逐行复述代码。稳定机器 ID、许可证、指令和类型 tag 保持原文。

新增请求复用实际RequestLease／RequestDelivery。选择context pins与动态day时明确新读点和错误政策。非法alias／wrong-owner不毒有效original；不能把某族共同关闭政策照搬给所有协议。完成标志由具体窗口定义：合法空选择、无库存窗口或已处理拒绝也可能完成，不能统一解释为全部资源已付款。已设为 true 后的晚事实异常保留 true；部分完成时保留 false 和已有前缀，原 cleanup 优先。跨await和最后getter后的首写前检查都要有真实消费者。

## 闭环而不是登记即支持

同步schema/default／serialize、finite board支持、能力实例、权限／目标／paid效果、两语提示、观察／事实、checkpoint／独立审计、运行源身份与公开API。Catalog状态和ruleCardRef只导航，最终执行支持仍由实际支持谓词决定。

测试至少区分合法原路径与一个真正失败边界；必要时用同Error、库存和事实顺序证明，不镜像内部eligibility逻辑。先明确静态／运行／全局验证范围，再按[验证指南](validation.md)收据与独审。新增规则语义需来源／新policy与独立预期，不借重构偷改。
