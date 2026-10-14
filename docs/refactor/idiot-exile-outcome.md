# 白痴放逐结果组合归属

## 本批职责

以 `623e8c8ef83c73fdfbef6a53f77154de7f70f02f` 的实际 Git 为基线，迁移白痴完整同步放逐钩子到 `rulesets/idiot-exile-outcome.ts`。原文件共 63 行，函数共 43 行；本批五个现行源码、一个删除。Idiot profile 挂载同名规则集函数，原赤月审计测试只换导入，旧角色私有钩子入口真实退休。

Demon 新 `reveal-ports.ts` 直接公开原权威的查询和提交，两函数与原 authority 是同一运行引用。原私有状态、票权及审计更新仍唯一由 authority 负责；普通白痴状态和警徽算法保持各自所有者，不新增缓存、状态副本或授权。规则集最终经现有 Idiot `ports.ts` 消费原 `getIdiotState`／`setIdiotState` 两绑定，profile 同族内部状态导入保持。

## 顺序与失败边界

- 原 Role／Alive 查询与角色检查后，先执行 Demon 审计查询，只有 null／undefined 才回退普通状态读取；查询异常不执行普通写入。
- 原生提交成功由权威同步更新库存、票权和审计；普通分支仍先翻牌，再关闭 `canVote`、清零 `weight`。随后才读取、处理警徽并发布 `idiot_revealed`。
- 后继警徽读取或事件发布失败保留已经写入的前缀，不退款；重复翻牌立即返回原免死结果，不恢复票权。函数仍同步返回，标死、阶段与剩余死亡波均未迁入。

## 核验与真实阶段

完整原函数非 JSDoc 树 387 节点／255 叶及 ESNext、CommonJS 两个整输出相同。两个消费者完整精确导入逆映射保所有原 body／断言／输入，共四个整输出；15 个原导入绑定均回到实际原端点。五个稳定控制源与 Git／工作树全字节同。155 个当前字面静态值模块的有限图未出现 authority 返回新规则集的路径；不宣称整个历史加载图或动态导入不变。

新增三个风险用例一次 3／0／22，原审计精准用例一次 1／0／7，共两个执行、四个不同 case、29 个断言，没有复跑成功项。首有限五 roots 类型检查只报新增 unit 的 `string` 组件名注解；修为 `ComponentName` 类型并只查失败一 root，真实退出 0，两个 whole JS 输出与首绿色测试字节的输出相同。首五职责头／606 Git 文档检查 0；该采样早于 unit 纯 type 修复，头文字未变，不伪称重新检查。完整证明亦真实退出 0。

## Root 架构审查末增量

Root 发现新规则集仍直接导入 Idiot 私有 state，已只把这一条 specifier 改到已有公开 ports。保存完整实际 current-before；两原状态函数与公开导出是同一运行引用，完整源精确逆路由相同，两个完整 ESNext／CommonJS 逆映射输出相同。当前 raw 模块输出的 specifier 确实不同，不宣称原二进制或完整初始化顺序恒同；现有 ports 只有直接导出声明，没有新增初始化算法。窄桥 `c0919f` 真实退出 0。

原完整 proof、155 静态图、types／heads／runtime 收据仍绑定修路由前的采样；保存原 scope、evidence 和文档全文，由这一条路由桥连接到最终五源码 SHA。没有复跑这些绿色项、原完整证明或门禁。

## 接口与覆盖限制

旧 `idiot/voted_out_hook.ts` 导入入口删除，是实际内部 API／模块布局变化；不承诺任意 namespace 重绑定或私有反射全等价。没有修改 RedMoon 放逐政策、Demon 权威、库存接受集合、生命／请求租约、警徽付款或严格档案政策。新源码及路由正常参与当前构建来源指纹，历史身份未改。本批有限风险与一个原审计用例不代表完整对局、所有角色或全门禁已通过。

证据见 [冻结范围](generated/idiot-exile-outcome-scope-final.json)、[完整证明](generated/idiot-exile-outcome-proof.json)、[真实收据](generated/idiot-exile-outcome-receipts.json)及[证据索引](generated/idiot-exile-outcome-evidence.json)。
