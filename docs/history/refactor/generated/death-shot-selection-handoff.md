# 死亡枪选择交付

源码冻结四路径，实际基线 `1428a210d931d4c043fb8d018f21e36c818fd05c`：

| 文件 | SHA256 |
| --- | --- |
| backend/src/game/engine/death_resolution.ts | c08ce2e4c79cf186f611ff0a3608039586d3eacfd4f370884fd82312247a4aa8 |
| backend/src/game/mechanisms/roles/nightmare_shadow/ports.ts | 20ced65a342efb7e098de7dbc5c3d52bedb3204da74c099327dce97ef762552f |
| backend/src/rulesets/death-shot-selection.ts | bf861923920049261ba7d0ff7f945b93cb2ae3e5ea19fbaca1036dd3db65b047 |
| backend/tests/unit/rulesets/death-shot-selection.test.ts | 647706adcca06529add877e690f9983a5e417f6f80d354ab5777943994064dac |

完整149行选择方法及四字段窗口类型唯一归规则模块。原角色钩子 callback 直接返回该 Promise，五 getter 只闭包，不提前读取或缓存 World／状态。原付款与双位置许可关闭不移动。原资格、资源、Factory、魔术师／梦魇 frame 与精准赠枪测试八控制不变。

新三个用例 67c43e：3/0/22；原精准赠枪一个用例 f71c02：1/0/5，32过滤；各一次。有限四根编译真实 session23751/a2262a 退出0。职责头四源/511文档路径 8c2dae 0诊断、中文0。

完整源证明 dfd95a：方法852、类型26、全结算器4631节点同；全部非注释叶及各自双完整输出同。21迁入绑定/48保留绑定与端点同，八控制全字节同。额外 query literal 首raw两不同如实保留，完整 tree/token 同后只该字面整体空白统一；不遮任何业务回调。首三工具失败及精确更正全部保存，不把工具红算源业务红。

`death-shot-selection-{before,edits,proof,inventory,receipts,heads,scope-final,evidence}.json`、完整 proof.cjs 和两个静态加载采样报告持久可查。静态 Factory393/owner400无返回结算器；require／动态 import 保原点。后继Wolf4df94bfa不改本四源，但可改变共同依赖，静态图保真实历史阶段，不重图或冒当前全传递字节同。

MD SHA `b18d72829fa0d6969576eca260f1556d9238d4af23bf6504aa3528840642498f`；scope SHA `59fc9157791ffbd4f10283862ffceba6afaaccf000c961c80c908ad3af422804`；evidence SHA `b93eba305c72e8fad01d431003c992ed66bdb5aefea5b8238665e75ff64c4733`。

新模块/类型/私有方法退休、调用栈及额外闭包对象是明确内部 API／初始化差异；不是整个新旧二进制、任意 monkeypatch 或全部 C24／C28 验收。未修改 Git、progress、矩阵、门禁、私有配置、模型、golden 或原测试断言。审查只读，不重绿色项。
