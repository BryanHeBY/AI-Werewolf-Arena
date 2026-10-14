# 秘密之身放逐翻牌与必需发言归属

## 范围与原始输入

实际 Git before 为 `e45c972b2a271a09bce51c103399af66714fc527`。本批三个源码：`VotingPipeline`、同族 `noble_secret_body/exile-reveal.ts` 和新的有界单元测试。原 64 行完整分支归本族具名 owner，投票流水线仍拥有目标映射、票据、实际放逐单位和最终结果。夜之贵族／秘密之身的库存与请求权限仍唯一归原 authority／requests；没有新规则、schema、租约或清理策略。

## 同步交接与失败前缀

新 owner 是具体同步生成器。第一次 `next()` 位于原分支处，按原顺序读取配置、authority、目标与身体终态。未启用、目标不匹配或身体非 intact 均同步返回 false；不会增加 await。触发路径仍先耗身、发布 God 事实、必需录制，然后创建原请求和原 scope。

生成器只交出原 ActionRequest。Voting 调用原 Provider 并等待原唯一 Promise，随后 `next(action)` 执行原 scope 复验、网关校验、再次复验、发言提交、事实与可选诊断。生成器 finally 关闭原 scope。Voting 的 finally `return(false)` 在 Provider 同步抛错／Promise 拒绝时进入该关闭路径；已完成或已因异常结束的生成器不会重复关闭。关闭错误沿原 finally 优先，错误对象不包装；已付款／已发布／已提交的前缀不回滚。

打开发言 scope 之前的必需录制或请求建立失败，原代码尚未进入 finally，本批保留该边界。查询视图 getter 在原表达式位置读取 World、events、gateway、options.day／isCurrent 及请求工厂，保持原方法 receiver，不早缓存对象、不新增 current 调用。scope 是运行句柄，不能当 JSON 或玩家许可。

同步生成器、getter 视图、调用栈和分配布局是有意变化；不承诺任意私有反射或 monkeypatch 等价。原公开 authority／requests 函数仍供其它调用使用；此批没有退休这些 API，也没有完成全部 C24／C28。

## 有界证据

- 实际新完整分支逆向后与原完整分支相同：680 非注释节点、460 叶；完整 Voting 为 6739 节点，保留程序也相同。四份完整映射 ESNext／CJS 输出相同，非首 child `deferOperation` 字面变异会被 harness 拒绝。首工具将 imports 恢复到错误位置的红记录保留，仅修工具原锚点，未改业务。
- 九个迁入运行 binding 与原物理 owner 相同；34 个保留 Voting bindings、七个 Git／当前控制文件不变。1684 个实际源码文件的 named／namespace／star／dynamic／require／ImportType 形式扫描找到两个新 owner 消费点；非字面 loader 未求值，不推断全部冷加载等价。新 owner 无顶层资源初始化，新增纯类型 imports 擦除。
- 原与今 Voting 都有九个 await；原分支只有 Provider 一个，新 owner 为零。首新增六例 6/0/54，原 intact Body 两次放逐／警徽成功例首次 1/0/10：七个不同成功例、64 成功断言来自两次运行。新 fixture 更正后四例另重复 4/0/42；没有把重复计作不同用例。
- 新 fixture 首误读 bootstrap 不公开的 roleRegistry；修为实际默认 registry 后误 import 装配模块造成一次模块加载红，随后改真实 permissions owner。原 SelfDestruct 构造只存引用，本族 case 显式禁用 preVote，未消费 registry。Root 提醒可不重复未消费字段的绿例到达前已执行这四例，完整历史保留，之后无重复运行。
- 首四根类型只新 unit 两诊断；第二 failed 一根仅 factory 错路径；末 failed 一根真实 0。disabled 早短路缺字段对象仅加 unknown 类型转换，生产输入／schema 未宽化。首真实职责头三源／525 文档路径 0，中文头存在性另外为 0；头形状合格不等于行为验收。

中文职责头解释输入／输出、原资源所有者与失败边界；重要数据／逻辑注释说明 getter 晚读、付款先于请求、Provider 交接及 finally 关闭。Voting 三条原英文并发／生命捕获／弃票修复说明准确译为中文。没有全量类型、全套测试、整局矩阵、重门禁、模型或私有配置调用。

机器证据见 [交付证据](generated/secret-body-exile-reveal-evidence.json)，完整原始源只保存一份 before；所有首失败、末类型与测试实际收据单列。
