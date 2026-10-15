# 共享契约与数据维护中文说明

## 实际范围与来源

基线为真实 `4f775d49f85eccc8eeb4da9c67517048879cadc4`。只修改已批准的 39 个源文件；完整 Git 文本、blob／mode 与开工工作源一致，保存在 `shared-contract-data-chinese-contracts-before.json`。八十处精确注释编辑包含三十八个英文职责头、原内联说明和关键数据／读取边界；前端 event-labels 仅翻译原有的一条诊断回退说明。

所有程序语句、类型及签名、导出、枚举和数组成员顺序、机器 ID／错误／消息键、用户或模型原文保持。许可证、实际工具指令与程序化 JSDoc 类型／tag 不作为普通文案翻译。源码 SHA 真实改变，不修改历史 sourceHash、strict 身份或豁免。

## 说明依据与边界

- 核心 board／schema／events／results 与 Lovers 保留同源兼容出口，未借翻译退休 API 或新建事实。组件名是原十一槽机器标识；只读与 `as const` 不等于运行对象已冻结。
- 板子声明、政策 ID、只读视图与严格 Zod 格式分别说明。schema 不补默认值，不验证角色总数或全部组合，也不是任意 Proxy 的惰性安全入口；真实参数绑定另有数据预检、复制和冻结。
- RoleId 保原六十四项顺序及九个规划身份，公共可变数组与私有成员判定序列分开；规划身份不等于可执行 Role。消息 ID 保原冻结注册表及其历史来源，文案参数由 game-text 校验。Locale 不存全局当前语言。
- 胜利归属／目标／主张与当前阵营分开；结果、夜／昼／投票摘要保原 optional／null。`target` 记录公开票选目标，`effectiveTarget` 是可选的实际放逐目标，格式本身不结算死亡或授予行动。
- `copyEventData` 先返回合法标量，再限制容器深度；子项先复制，再核数组长度及索引覆盖。有限数值、数据描述符、标准或空原型、symbol 与稠密数组边界不改。反射仍可能执行 Proxy trap 并抛错，不声称通用零副作用净化。
- Animal／Fragrant 及其他递归事实 reader 保复制后的精确形状、历史关联、null 拒绝及异常捕获；受众分类不自动完成某位玩家的可见投影。Fragrant 知识绑定是数据一致性，Animal 通知布尔值不是实时许可。
- Awakened／Mechanical／DeathAbility／Merchant／BlackMarket／Hybrid 保原浅层描述符读取，不追加递归复制。未用字段及 symbol 的接受面按原代码保留；Hybrid 在取值后拒绝分支外字符串键。反射异常可以传播，不能统称所有 reader 都返回 null。
- 两商人的结果候选保留原 `unknown outcome` 值／引用，调用方先生成技能文案，随后校验结果；这不是严格归档 DTO 或库存提交。赠枪事件时点与剩余次数不等于当前开枪资格。
- 丘比特配对保输入顺序；千面人牌槽、盗贼保留身份、孤独少女可选历史 camp、野孩子上帝／玩家通知、噩梦之影双形状、赤月使徒延期、学者／导师额外查验披露及三族交换／映射各按实际分支解释，未增加 schema、目标限制、付款或回滚。

完整阅读上述源及真实公共出口、后端归档 schema／受众校验、BoardParameters 输入边界、GameActionRequestFactory、复盘 reader／标签及 game-presentation 的技能／关系 formatter。旁读只用于语义依据，不声明这些消费者构成完整运行闭包。四份同字节 controls 为 GC index、recording/reproduction、frontend replay-event-reader 与 action_request_factory；已与另两批作者确认无写入交集。

## 有限验证与收据

SourceReady `109f1220` 是首次静态源冻结，`checksRun=false` 仅描述该捕获时点。之后 Root 唯一首次执行两项检查，源码一直未变，原回执及 stdout/stderr 已保存。

完整证明 `4a8c7f / session 98379 → 00b678 / exit 0`：八十处注释完整正逆得到三十九个实际程序；20233 typed nodes、2565 NodeArrays、24851 非注释语法叶、完整树与叶文本相同。程序化 JSDoc tags／受保护注释均为原 0 项；78 份 ES2022 ESNext／CommonJS whole raw 输出逐字相同。统计是脚本实际遍历口径，不是全部调用图或运行行为覆盖。

职责头 `6b2d81 / exit 0`：39 源，当次 Git 索引文档路径 731，诊断及中文头失败均为 0。两项只首跑一次，没有追加或重复绿色检查。

未请求或运行类型、业务测试、生产、模型或全门禁。完整程序／输出相同和职责头形状不代替非作者的中文含义及领域边界审查，也不宣称全部玩法、角色 schema／codec 或严格归档验收完成。审核报告排除作者 artifact 摘要，避免循环。
