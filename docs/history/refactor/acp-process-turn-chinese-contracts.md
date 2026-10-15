# ACP 进程与任务端口中文契约

## 范围与来源

真实基线 `e0dd0306998ec7ffa5fe52bb01f2c75cc1d279cc`。六源完整 Git 前样与编辑前工作树逐字相同，首轮共 37 条精确注释编辑，后继仅客户端三条中文精度校准：ACP process client 23、ACP index 1、游戏 MCP control 4、游戏 MCP server 5、任务执行契约 3、runtime index 1。生产语句、字段、签名、导出、机器协议、错误与模型文本未改。源码 SHA 因注释改变；历史 strict 身份保持原规则，不新增豁免。

## 就地说明

- 创建使用外部期限与初始化预算的较早值；资源按实际建立顺序登记。创建等待中止不抢占底层 Promise，原检查点、清理和调用方迟到退役继续承担资源处理；不承诺所有迟到资源已成功回收。
- registry 身份与 ACP wire sessionId 分离。MCP 批准只沿原注入 server／toolCallId 登记和选项次序；实际游戏许可仍由 registry／ActionTurn 复验。普通取消只是有界通知，更新消费结束与 promptEnd 回调不等于会话关闭。
- closed 封住新 prompt，closing 复用首次关闭任务；force 可在普通关闭已开始后发信号。已捕获的收尾失败继续汇总，未全 catch 的原调用仍可能直接抛出；reclaimed 只表示根进程退出及控制面关闭，不证明所有子孙已确认退出。
- stdio MCP 保原发现 schema。无效提交先交原 turn_id 的 owner 再返回拒绝；HTTP 状态不在 invoke 中额外校验。文本现场 JSON 序列化，structuredContent 保原引用，仅 `ok === false` 标记错误。
- 通用执行端口只声明超时输入、结果与 close，不实现取消／授权／回收。审计 pipeline 持 finally 关闭；具体 SDK 的无资源关闭与 ACP 资源收尾保持各自原实现。

两个完整字节 controls 是实际 `acp_action_provider.ts` 与 `acp_audit_runner.ts`。语义旁读 `player_agent_factory.ts`、`loopback_mcp_control_server.ts`、`acp_turn_registry.ts`、`turn_deadline.ts`、`session_lifecycle.ts`、`session_pool.ts`、审计 pipeline 与 SDK executor；这些旁读不宣称全闭包 immutable controls。F02 与 F03 作者确认其 controls 不包含本六源。

## 有限检查与限界

首采样唯一主 proof `2354b2 / exit 0`：全部六程序精确 comment 正演，完整 3704 typed nodes、4577 非注释语法叶相同，原 JSDoc tags 与保护指令数量均为 0，12 份移除注释的 ES2022 ESNext／CommonJS 完整输出逐字相同。首采样唯一职责头 `551cb5 / exit 0`：六源、当次 Git 索引文档路径名 664、诊断及中文头失败均 0；头检查不核文档内容或说明真实性。

首轮 proof／heads 及 37 条 edits 保持原字节和采样。Root 实读后将客户端文件头限定为创建等待中止、不抢占底层 Promise，并将两条收尾失败说明限定为“已捕获的失败”。末 `ee55d7 / exit 0` 窄 comment bridge 对客户端完整前样精确正逆，2857 typed nodes／3492 非注释语法叶及两份完整 ESNext／CommonJS 输出同；其余五源原字节未动。首 head 未重跑，未把首采样改记末源码。Root 首报告改存 `root-review-first-snapshot.json`，末报告独立重绑。

首轮均通过，未运行生产、业务测试、类型、模型、全门禁或重复绿色检查。本证明只验证纯注释维护和相应输出；说明的职责、失败前缀与回收限度仍交非作者读实源审查，不作为完整玩法、任意 CJS 反射或冷加载验收。
