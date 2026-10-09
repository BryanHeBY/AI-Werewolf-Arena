# 运行错误诊断边界（P3）

## 目标与所有权

模型/ACP/审计/记录的异常不再通过`String(error)`、任意`Error.message`或完整对象进入日志与新玩家错误记录。`describeError`只提取受限事实，`formatErrorDiagnostic`按显式展示语言补人类说明；这不是新清理框架，也不改变原异常的throw/聚合、SDK重试、fallback动作或资源消耗。

共享`ErrorDiagnostic`属于`replay-contract`，供私有文件和审计消费；不依赖后端引擎或模型SDK。字段只允许：

| 字段         | 约束                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| code         | transport_error / request_timeout / request_aborted / rate_limited / authentication_failed / permission_denied / model_unavailable / network_error / filesystem_error |
| statusCode   | 可选100–599整数；原始HTTP状态                                                                                                                                         |
| retryable    | 可选boolean，来自实际SDK异常`isRetryable`，不是按code擅自决定                                                                                                         |
| retryAfterMs | 可选0–86400000整数；仅接受delta秒形式Retry-After，最多三位小数，十进制精确换算                                                                                        |
| fileCode     | 可选固定errno：EACCES、EPERM、ENOENT、ENOSPC、EROFS、EEXIST、EMFILE、ENFILE、EIO                                                                                      |

没有URL、请求体、响应体、任意headers、认证、环境、异常类名/原话、stack、cause对象或provider配置字段。普通字段只读自有data descriptor，不调用外部getter、toString或toJSON；对象探测失败安全回落。原生DOMException通过捕获的内置name getter做品牌检查，实例遮蔽getter不执行，支持原生AbortError/TimeoutError。

沿`lastError`/`cause`最多8个对象，检测环；可读取真实SDK RetryError最后一次HTTP事实，不遍历整个AggregateError.errors或任意对象。未知/过深错误得到通用code。HTTP日期形式、超界/不合法Retry-After不猜测。没有额外读取模型响应体判断“额度已耗尽”：429仅证明服务限流，说明建议检查额度或并发；401/403只描述认证/访问拒绝，5xx描述服务端错误，不保证是临时错误或自动重试。

## 记录与呈现

新私有delta的`request_error.content`是稳定code，新增可选`diagnostic`为上述结构；shared reader校验实际返回的独立快照及其code/范围/额外字段，旧读者可以忽略新字段。私有v2不再次变更版本。旧档的原始request_error.content仍原样保留，不声称历史秘密已清理。原有prompt、玩家发言、模型思考、工具原始合法动作和定制字符串保持原文，不对玩家内容做猜测式过滤。

LLM和ACP错误记录使用同一诊断契约；ACP逻辑操作reason写code，output只存diagnostic。审计context通过共享readErrorDiagnostic从自有data descriptor生成独立标量快照，再校验实际返回值；getter被拒绝，不存在先校验再变化克隆的窗口。可以接收验证通过的diagnostic scalar事实；legacy错误原文和不合法/夹带额外字段的diagnostic省略，其他任意传输input/output仍不开放。领域事件、证据序号与原始玩家文本不变。

告警显示语言独立于数据语言：LLM provider的displayLocale传给observer.locale，缺省跟随World；runner显式传终端语言。SessionRecordManager.create的第三参数是transient displayLocale，供file/flush告警；manifest/private.locale仍游戏语言。AuditTaskRunnerOptions.displayLocale经pipeline传递，检查任务runTurn.locale仍检查语言。ACP终端error字段只显示安全事实与本地化说明；消息/思考和工具名称仍按原有观察协议展示。

## CLI边界

run_game不再打印完整异常并二次throw：顶层只报告安全配置code/path与diagnostic，然后exitCode=1；程序化main仍reject原始错误。configDiagnostic读取typed自有data descriptor，closed CONFIG_ERROR_CODES仅允许已知机器ID，任意namespace形状的异常正文也不能变成输出code。BoardConfigurationError路径只接受既有有限字段路径语法；未知异常不扩展路径。

模拟/迁移/mock入口也不回显异常原文；它们的程序化错误/回滚策略保留。其余CLI/配置报告/观察说明与英文运行已在后续P3批交付，当前阶段证据见[p3-activation](reviews/p3-activation.md)；本页只定义错误边界。

## 验证范围

- 真实安装SDK本地HTTP401：一次请求，原有非重试策略不变；合成响应/body/key/headers标记不可达玩家错误文件和终端。
- 真正SDK RetryError构造的429，LLM/ACP×中英，加逆向displayLocale；fallback动作/次数不变，ACP关闭一次。
- 原生DOMException与遮蔽getter、JSON hooks、环/深层、十进制Retry-After、未知/非法字段和历史原文。
- recording locale与displayLocale、inspect locale与displayLocale独立；私有manifest仍机器/游戏语言。
- 实际run_game坏provider JSON退出1，无JSON秘密或二次stack；message/fieldPath getter与Proxy探测失败不突破输出边界。
- audit context只收严格diagnostic，poisoned额外字段/原异常不进入；输入不变。

以上是本次基础路径与合成故障的证据，不是保证任意原始玩家文本都不含用户主动提供的秘密，也不代表未来所有角色/接入矩阵已验收。P4仍承担共同接收、取消/排队、资源与原错误保留的完整交付。
