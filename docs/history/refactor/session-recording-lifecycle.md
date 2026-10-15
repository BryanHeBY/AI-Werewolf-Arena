# C38 单会话录制生命周期交付

实际来源为 Git `d0d2dad8`。三个生产文件及两个新测试的固定摘要、命令和审查见 [固定证据](generated/session-recording-lifecycle-evidence.json)。

## 唯一状态归属

`SessionRecordingLifecycle` 真正持有原六状态：`closed`、`closing`、定时器、串行队列、首次终结 Promise 和首次结束元数据。定时／主动刷盘、失败告警及重复终结实际接入，不保留管理器的第二套状态。

`SessionRecordManager` 保留聚合、文件内容、dirty 标志、复现轨迹、必需失败账本及发布顺序。`ReplaySessionAggregate` 与 `ReplayFileStore` 分工保持。生命周期不是通用清理框架，不决定游戏规则或汇总对局错误。AsyncLocalStorage 上下文仍只传播会话，不创建或关闭资源。

## 时点与失败前缀

`finalize` 非 async，返回首次原 Promise；首次失败也保留，同一元数据引用用于最终发布。`beginClosing` 同步执行原 `closing → finalMeta → cancelTimer → enqueue`；管理器仍在原位置 await 同一队列，然后写 closed，紧接原最终发布，没有增加 Promise adoption 或延迟 strict 写入启动。

closing 期间 `flushNow` 只等待旧队列，不绑定最终文件发布。必需逻辑操作已拒绝；普通记录仍可在 closed 之前追加，且不新排定时器。closed 后普通记录按原语义忽略。

严格前缀错误先进入原账本，再记录轨迹错误并交给原队列告警。告警回调正常返回才恢复队列；告警本身抛错也保留原语义。最后文件即使成功写出，仍按原顺序报告此前必需失败。初始化及终结的单错误原样、多错误 AggregateError 顺序不变。

以下原策略仍保留，不在本次提取中修正：`beginReproduction` 只拒 closed／已有 trace，未额外拒 closing；最终可选写、序列化或玩家 projection 异常仍可在必需失败汇总前短路。可选 FileStore 只吞其写入 try 范围内的 IO 错误，不承诺吞全部序列化异常。

## 中文说明与有限验收

- 管理器、生命周期、上下文和新测试有中文职责说明；关键 Promise 身份、关闭时点、部分失败和测试输入来源就地说明。
- 新 4 用例 + 原 mandatory-prefix 4：实际 `8 pass / 0 fail / 29 assertions`。覆盖失败前缀、慢刷盘、重复失败 Promise、首次元数据、关闭期普通／必需记录及多初始化错误。
- 原并发 ALS 会话隔离有界用例：实际 `1 pass / 0 fail / 2 assertions`，9 个其它用例未运行。
- 有限严格类型检查 session `12471` 已实际退出 `0`。环境切换随后清空临时日志；终态和首次测试日志读取结果保存在工具历史中，不伪造日志、不因丢失临时文件重复执行已通过检查。
- 完整管理器精确逆迁后 ESNext／CommonJS 程序同原源，六处实际生命周期正文／同步前缀同原，上下文程序只改注释。五职责头与 scoped diff 检查均为 0。

Root 实际源审及两个独立方向终审均通过：五个最终 SHA、两份实际 Git 原源、完整发布／失败正文及中文说明无待修项。独立审查只读 source，不重复测试／编译。原 schema2、归档键序、strict 准入、RNG 和录制失败政策未修改。新源自动进入现有完整指纹，旧构建 strict 仍按原政策拒绝不同精确构建。

## 未完范围

本批交付录制生命周期的唯一 owner 及具体边界。C38 的完整 runner cleanup／错误矩阵、剩余记录策略和 P7 阶段验收仍需后续汇合，不据此标记整个 C38／P7 完成。未运行整局、全量门禁、模型或网络。
