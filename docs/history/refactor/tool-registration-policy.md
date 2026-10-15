# 工具兼容注册

`ToolSpecRegistry` 在原构造循环中调用具体注册政策。相同原对象不读取 parameters；不同对象的完整 own-data 参数结构相等时，仍选择最后的原对象及其人类提示。对象键顺序不影响比较，未知关键字、嵌套数据、数组位置和长度都参与，数字使用 Object.is。这是有界的数据结构比较，不是 JSON Schema 语义等价或合法性证明。

已知结构不相等的同名工具改为在 conflicting set 之前报 `tool_schema_conflict:<name>`。原先最后覆盖的两个输入和结果均保留为 characterization，这是单独声明的注册政策加强，不登记为机械等价。原 Map.set 方法查找、一次 name 读取及最终 set 的相对顺序保留；新检查发生在 name 读取之后。

accessor、继承的 parameters、Proxy、嵌套 getter、特殊原型、symbol、循环、非 JSON 值，以及超过深度或数量预算的参数明确属于 opaque，保持原延迟读取与最后覆盖。这些结构尚未完成一致性验证，不因本批成为“已校验配置”。不创建参数镜像、缓存或未被消费的 metadata；参数和提示仍是原对象，原有修改及首次使用缓存语义保持。

`ActionReception` 具名导入实际注册 owner，完整类正文不变：首次验证仍读 parameters 两次，后续一次；schema 仍在首次使用时建立并缓存，原 getter 抛错仍保同错误与重试。65 个领域工具、120 个贡献、八组重复与三个 SDK/MCP 传输工具分别保留其实际职责。

九项新增测试、45 次断言，以及原机器 schema、Demon 原生和双语自定义提示三项、26 次断言通过。有限类型检查实际退出 0；发现的旧 Guard fixture 只读字段种子写入已在独立 `60846ea6` 以测试可写视图修复，生产约束不放宽。独立完整源码逆向、四个职责头及八次原/现 cold import 均通过。测试类型注解与审查 harness 字段错误的原红证据保留，没有重跑全量对局。

完整 RulePlan、opaque 参数的一致性、参数冻结、阶段和工具使用声明仍待后续闭合；checkpoint、Tape 和现有归档形状未改。
