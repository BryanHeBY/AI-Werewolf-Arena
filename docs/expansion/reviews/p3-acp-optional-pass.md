# P3 激活前置修正：ACP可选空行动

日期：2026-10-08。完整十二人ACP场景实际发现：prompt正常结束且min_valid_actions=0时，旧ACP仍调用fallback并把合法pass记为失败；SDK已把同一情况记录none。当前标准基线在自爆窗口返回null，但定制fallback可能把主动pass改成自爆。

修正仅对`model_declined_required_action`的正常prompt完成与min=0：记录none、返回null、不调用fallback。已经收到的action、必需动作缺失、runtime_error、超时/取消保持原策略；turn关闭、cancel/drain和session复用所有权不改。此为独立行为修正，不能混称只有翻译，也不代替P4完整共同接受校验。

- 新可选/必需对照2测试：故意提供会自爆的fallback，合法pass不调用，required恰好调用一次；记录fallback flag与close次数核对。
- 原ACP/MCP授权和lifecycle合计8测试52断言通过。
- 真实ACP十二人S02/S03每种两语：自然好人胜、正确存活/药/枪/警长/自爆，零拒绝/错误/回退；实际进程+注入MCP、Tape重放均已通过（完整矩阵随激活批记录）。
- A/R独立复查分支与旧策略，0剩余阻断；原required旧测试补显式min=1，避免用默认optional请求错误地断言必需fallback。

没有更改行动规则、资源、stage、受众或模型接入权限。P3激活门槛与P4–P10仍继续。
