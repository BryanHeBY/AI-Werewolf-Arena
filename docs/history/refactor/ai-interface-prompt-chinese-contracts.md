# AI 集成与提示模板中文契约

## 范围与语义

实际 before `d92d0a4033367ad5b3bdb15f44f75a3b352b46c6`。只修改三个文件的 25 条注释记录，不改标识符、字段／类型、字符串、消息 key、导入重导顺序或任何运行代码。

- `ai/integrations/index.ts` 解释原三个叶的直接重导绑定，期限、取消和关闭仍归具体所有者；不承诺所有被导入叶无顶层初始化。
- `player/prompt_templates.ts` 解释身份／人设、回合提示与配比 Map 的输入，语言缺省、原引用与 getter 读取、Role 枚举顺序、两轮角色回调及异常传播。工具集合、requiresAction 和阶段文本仅作提示，不构造资源或行动许可。人格保原两处 trim、工具／报告开关保短路；重试只按 1／2／其余选择文案，不实施额度或实际重试。
- `acp_mcp_bridge.ts` 解释 sidecar 配置、start/bindSession/close 与 registry factory 类型。声明不自起进程、监听器、token 或认证／沙箱。参数与环境数组仍可写、不在这里复制；实际关闭、force、取消和期限责任仍归 control／Process/session owner。

语义旁核完整 PlayerPromptPolicy、AcpProcessClient/defaultWerewolfBridge、Werewolf/Loopback 控制和 session_lifecycle，以及实际 ACP 提示和 LLM 重试调用点。这里只读这些消费者，不编辑它们或增加实现／框架；产品提示和协议标识均保持原文。

## 轻量证明与真实失败

[完整 before](generated/ai-interface-prompt-chinese-contracts-before.json) 保存三份真实 Git 原字节。[精确记录](generated/ai-interface-prompt-chinese-contracts-edits.json) 能将完整源正向到当前、反向回原 Git；[token 证明](generated/ai-interface-prompt-chinese-contracts-proof.json) 核 1,085 个非注释 token 的种类与原文全同，不做全程序 AST／emit 镜像、类型编译、测试、模型或全门禁。

首 token 工具真实红：没有重扫模板插值 tail/middle，将随后内容误并入模板 token。保存原执行脚本与日志，只修工具；末 `c1397f` 真实 0，不改产品代码迎合证明。

职责头首次三根／536 个 Git 文档路径有两项诊断，均属 index 缺期限／取消责任。只补该出口不处理、原具体 owner 负责，失败一根复查 `8c19c4` 真实 0；其他两绿根不重复。首诊断和源码阶段哈希保留，最终完整 token 证明覆盖补头后的三源。[收据](generated/ai-interface-prompt-chinese-contracts-receipts.json)。

这是一个局部中文维护批次，不代表完整 C45／最终架构验收。source 注释改变当前构建 sourceHash；历史身份不改写，不提供跨构建复现豁免。[最终范围](generated/ai-interface-prompt-chinese-contracts-scope-final.json)。
