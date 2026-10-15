# 公共游戏契约中文说明

## 实际范围

基线为真实 `ce0353ce7bc9fa3ab9be9b34df3266848f5d6c05`。指定的六源均存在，完整 Git 前样与开工源逐字同。共 36 条精确注释编辑：requests 10、actions 9、events 8、identity 4、message-refs 2、night-ability-views 3。已有中文头保留，English 说明译准并在关键结构处补说明；未改枚举值、成员顺序、参数、字段、optional／nullable／readonly、签名、exports、机器／模型文本。源码 SHA 真实改变，历史 strict 身份规则不改。

## 说明与实际消费边界

- RequestExtras 可选，正式 context 的 day／stage／visible_events／turn_constraints 必填。声明不解析未知输入，期限、ID、名单和数据拷贝不带原 envelope 的许可或完成身份。具体 getter、最早预算和撤权仍由运行 owner 决定。
- 工具 name／args 保原判别关联，null、abstain、activate 没有被统一。校验结果的 ok 并未在类型层强制关联 sanitizedCall；数据回包不等于付款回执。工具／阶段的原顺序和值不因注释改变。
- 当前 Role、Camp、胜利成员关系与查验／玩家标签分别由实际 owner 形成，机器枚举不替代现场资格。指定事实的 audience 是发表时历史数据，readonly 不冻结数组；开放的玩家 payload／seq 仍由实际投影和读器处理，不保证连续或运行授权。
- ExileFeedback 的旧英文“actual exile”已按真实捕获函数收窄为当时 camp 查验标签。普通规则在标死前捕获已接受目标，动物路径在原死亡门控后捕获；类型不证明目标已死，时点与交付仍归原规则／阶段。
- MessageRef 是 key／可选参数形状，不渲染或替换调用方、用户、模型原文；缺失／多余／非有限参数由实际格式化器验证。readonly 不复制或深冻结对象。
- 能力 metadata、kind/state 关联、状态和历史属于数据／玩家知识形状，不提供本体库存身份、来源有效性、资源写权或请求许可；公开 DTO 仍排内部披露／抑制标记。

两个字节 controls：GC `src/index.ts` 的实际公共出口，以及后端 `core/domain/actions.ts` 的中立声明／既有常量出口。旁读实际请求工厂、约束解析、玩家 feed、能力投影、message 格式化与守墓人反馈／放逐准备；旁读不被计为 immutable 全闭包。未修改 package exports、类型版本、运行读器或 F02／其它作者源。

## 一轮有限核对

主 proof `c87e54 / exit 0`：全部六源精确 comment 正演，完整 4875 typed nodes／5694 非注释语法叶同，JSDoc tags／保护指令原数量 0 保持，12 份移除注释的 ES2022 ESNext／CommonJS whole raw 输出逐字同。职责头 `c81e2b / exit 0`：六源、当次 Git 索引文档路径 668、诊断及中文头失败均 0。检查后六源未再修改。

没有运行类型、业务测试、生产、模型、全门禁或重复绿；完整程序／输出相同不代替说明语义的非作者阅读，也不扩展成全玩法、冷加载、55 状态 codec 或严格档案完成声明。
