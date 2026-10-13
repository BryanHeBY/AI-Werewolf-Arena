# C13：构造、驱动与独立预期

首批 15 个支持模块按真实行为迁入 builders、drivers、oracles 或对应机制目录。Animal roster 等只构造输入；Noble authority 驱动拥有动作控制；临时目录驱动拥有写盘与清理；历史/协议 oracle 保留自己的字面预期和独立 fold。

162 个消费者同步调整，共 177 文件、229 个模块路径。独立审查直接与 `dd23d71` 核对全程序，只允许路径及 15 个职责头变化；TypeScript 解析和真实目标一致，2 个动态 temp-directory import 单列。1660 个原唯一用例标识、标题和矩阵未改。

默认 setup/preload 的清理时点与同一个 singleton 保持。三份相关内存测试 30 项/76 断言通过；必要 backend 测试、tooling、frontend 与 contract 类型通过。907 原 fixture 未改，未执行大套件。

两份被可执行 fixture 直接导入的 helper 暂留原位，后续与 3 个脚本的机械来源切片闭合；没有加薄兼容转发。复杂混合 driver/scenario/recording helper 继续按实际职责拆，不能据首 15 项宣称 C13 完成。

## 惰性 LLM 客户端驱动

原 `llm_provider_clients.ts` 归入 `support/drivers/agents/llm-clients.ts`，七个真实消费者同步切换，旧路径删除。客户端仍用调用者提供的字面动作、参数和消息断言驱动原回调；固定工具名等协议断言保留原文。消息、工具、失败一次及无动作等状态仍属于每个原实例，没有新增共享缓存或模型请求。完整玩法预期仍由调用者拥有。

八个原程序只变模块路径和职责头；完整类型程序逆映射、实际导入目标及独立 source 审查通过。73 个原用例标识及所有标题、参数矩阵、输入和断言保持，未运行测试发现或完整对局。缺失的原警徽测试职责头补为实际 bounded 检查和死亡结算说明，未据此冒称该混合文件已完成分层。[证据](generated/inert-llm-test-driver-evidence.json) 保存各文件摘要与有限类型结果。

该迁移只收拢客户端执行职责。复杂录制／传输 driver、feature 支持模块、独立 oracle 和可执行 fixture 的剩余工作继续保留；前述首批历史映射的输入摘要不改写为本批源码。
