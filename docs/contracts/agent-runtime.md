# Agent回合预算、取消与资源

LLM／ACP的选择只通过同一ActionRequest及完成端口交给领域。回合绝对deadline取请求期限与provider预算中更早者；排队、初始化、工具循环和required-action retry共用，不因重试刷新。

provider内scheduler按明确provider ID共享限额，跨provider独立；不宣称控制同密钥别名或多进程的全局并发。关闭拒新工作、取消并等待本owner操作和lease释放；逻辑active／queued归零不等于任意注入传输物理资源已释放。

ACP wire session ID只在连接内有意义，内部registry key绑定具体owner，模型turn_id仍原短ID。MCP无效turn先核owner／开放状态；原JSON返回引用和受众不被文档整理改成新schema。

创建等待中止不抢占任意Promise，也不等于向已建立会话发送cancel。晚到创建仍归原owner回收；有界close超时要报告未完成，不能先清计数伪释放。内置session／MCP／进程的取消、graceful、TERM／KILL和清理保各自实际捕获失败范围，不能承诺任意getter／wait／destroy／unref throw都已被统一catch。

Fallback可在原政策下处理模型失败或预算耗尽；外来TimeoutError／AbortError不因名字相同就当自己的取消。body、关闭、最终保存／observer flush真实错误不能被晚回调覆盖或静默二次兜底。

`runtimeState`是逻辑只读摘要，不含密钥／命令／actor scope。真实HTTP abort、子孙进程退出与控制面端口回收需要本机传输证据；完全离线unit不证明物理资源。运行方式见[指南](../guides/run-locally.md)，完整验收范围见[验证指南](../guides/validation.md)。
