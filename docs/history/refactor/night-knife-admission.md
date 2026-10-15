# 夜间过期狼刀准入组合

## 实际职责

before 为真实 `d491710a5fd95051dbafc8d9a6b4b8ced92f24c1`。五个源码路径：NightPipeline、鬼魂新娘 night_stages、原普通狼 knife_scope 删除、新 rulesets/night-knife-admission、新单元。实际旧两个清理函数只有 NP 三组调用，没有其它业务消费者。

两个完整原算法归规则组合的私有子步骤，公开唯一同步 `discardStaleNightKnives(runtime)`。普通刀完整生命／版本／原标记／现场目标政策与婚约权威检查分开保留，不合并规则或引入通用清理框架。NP 保阶段推进、provider await、current／readability 与最终伤害，将原阶段前、阶段后、伤害前的三组调用接到组合。

原顺序逐点保持：普通刀 world→state 参数先读；本步无 scope 的 return 不跳过后续婚约归属读取。ownsWedding 为 false 才跳过婚约参数，true 时按 world→day→state 读取，即使传入 state 的 scope 已为空也先求参数。延迟 runtime 只持原表达式，不预读 World、缓存名单或创建原体／请求许可；新增运行对象和调用栈分配是明确布局变化。

普通过期刀先移 scope.marks，再查现场 marks 并移标记，然后清 wolfTarget／wolfTargetScope；中途失败留下原已写前缀。婚约刀只移原 scope.marks 后清 stage，不能扩成现场 marks 路径。历史票仍已记录，清理不换刀、重试、付款、退款、补 current、await 或 cleanup。原 bindWolfKnifeTargetQuery 与 weddingKnifeCurrent 的实际声明／receiver／内部政策不动。

原 Wolf 物理叶退休，鬼魂新娘阶段的旧清理导出删除，不保旧桥。鬼魂新娘仅新 unused World／NightStageState 的 type imports 删除，原票与刀阶段保原程序，职责头／票说明译准确中文。新 owner 不把 callback、scope 和 World 序列化成 DTO。

## 有界证据

[before](generated/night-knife-admission-before.json) 保存三原源实际 Git 全文和四个控制 SHA（两个实际 query ports、Alive 版本、原撤权场景）。[完整程序](generated/night-knife-admission-proof.json) 从真实新 owner 读取普通、婚约和完整组合程序，再逆三个调用点及两完整消费者，共 3,139 typed 节点／完整非注释树与叶、10 整段 mapped ES/CJS 输出同。首工具用六空格 substring 误匹配八空格内层调用，`907717` 实际 1；仅工具改完整行匹配，`ea8298`／session 24579→`bab5ab` 实际 0，产品没有求绿改写。

[绑定](generated/night-knife-admission-bindings.json) 核 NP 和婚约阶段全部模式／名字／别名／路线，并跟踪七个原 type/value binding 的物理声明相同。婚约 authority 直路线改现有公开 ports，加载路径有实际调整；b8b3f1 采样的当前静态 401 模块／2,117 边不返回 NP，未执行冷加载或冒完整历史图等价。后继 Root 自爆窗口等并行 source 不属于本冻源／此图阶段。五个当前源码根（backend/src、backend/tests、frontend/src、packages、tooling）的字面 import/export、inlineType、dynamic/require、importEquals 盘点旧 Wolf 叶和两原清理 named consumer 零；不穷尽计算或仓外加载，也不包括其它根或历史 generated。

[真实收据](generated/night-knife-admission-receipts.json)：新两个字面风险例 `4a165d` 2/0/10；原刀在行动期间撤权精准 `4aec2b` 1/0/4、2 filtered。两执行三个不同用例 14 成功断言，未重绿。有限四 roots `6ff5d0`／session 60359→`d0a146` 真实 0；真实职责头四源／542 同 Git 文档路径 `542eb1` 0，中文头缺失 0。本批 diff 和两新源空白已核。

未跑全门禁、整局、模型、私有配置或完整旧测试组。原 PM、DR、Trickster、角色 authority、录制和 verifier 不改；这批只收走实际夜刀准入／清理组合，不代表 C24 或玩法总验收完成。[冻结范围](generated/night-knife-admission-scope-final.json)。
