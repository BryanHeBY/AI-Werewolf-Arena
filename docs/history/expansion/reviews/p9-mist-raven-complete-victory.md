# P9d：迷雾鸦影延迟屠边与非法后夜自救

状态：本批离线完整／失败录制切片完成，前置 `70cff93`。角色仍 planned、44/64；新角色实际通信、多种子与前端继续。

## 三份自然狼人胜利

固定原身份／座位，三份人工计划各中英实际 PM→Trace→SessionRecorder→finalize→磁盘独立解析→精确 Tape：

| 计划               | 夜死                   | 自然终局                    |
| ------------------ | ---------------------- | --------------------------- |
| last-villager-pass | `[5] / [7] / [8]`      | D3 Day／night_settled／Wolf |
| last-villager-heal | `[5] / [7] / [] / [8]` | D4 Day／night_settled／Wolf |
| last-god           | `[2] / [4] / [1]`      | D3 Day／night_settled／Wolf |

末民计划 D1 放逐6、D2白痴4翻牌；翻牌仍Alive、仍计神职，仅失票，不产生放逐4。D3的8是最后村民，Snake等待点实际仍Alive，尚无第三次夜公告或GameOver。pass后8死亡才判屠边；heal保8继续D3放逐12，D4蛇已耗，使用普通公告顺序，8死亡后判屠边，无D4发言／投票。D4恰三狼仍不解封。

末神计划 D1 放逐摄梦3，不牵连原梦游5；D2刀4、放逐6，D3刀1，最后神炼金在救治等待中仍Alive、未判胜。后夜不允许自救，原刀口1仍可知但候选为空，只pass，库存保1；1真正死亡后才判屠边。三份都没有额外刀、解封或 dream_death。终局原因均为 slaughter_side_completed，不用max_days退出。

## 非法后夜自救的真实失败 Tape

末神计划只把D3蛇回复改为 `use_snake(target_id:1)`，得到真实 Gateway 校验的 `snake_action_invalid`，位于库存消费与chosen事件之前。两语都保存完整失败 CP、cycle错误、runtime_error finalize和磁盘录像，再用相同原动作在真实引擎中精确重放失败。

最后CP是D3 Day、complete=false、gameOver=false，1仍Alive，healRemaining=1，历史只有两次原合法pass。第三夜没有Snake事实、夜死或胜负。Trace保存实际非法action outcome，不伪造decision error。

测试helper只为这个具名失败计划接受第3周期的这个原生Error；其它情景、其它周期、其它错误继续原样抛出。正常路径仍要求自然gameOver且拒max_days。计划天数按明确数组长度约束，旧16份保持三夜，只有last-villager-heal允许第四夜，不构建通用失败框架。

## 交叉审查与门禁

- R：独立手算原计划与Day/night_settled终局，核白痴、白天摄梦死亡及后夜禁自救；当前8项／192断言全绿，`/tmp/awa-mist-victory-r-final.log`。
- A：原8项／192断言全绿；另4项／20断言确认普通计划同名错误不被吞掉、具名失败计划其它错误或第2夜同名错误仍reject，以及旧计划仍限制三夜。日志 `/tmp/awa-mist-complete-victory-a-review.log`、`/tmp/awa-mist-victory-failure-boundary-review.log`。
- T/L/D：8项／192断言全绿；确认失败真正发生于校验而非夹具直接抛错，逐CP／请求／事件／操作精确Tape与落盘链完整，旧计划内容不变。日志 `/tmp/awa-mist-complete-victory-delivery-review.log`。

主维护相关七文件 **136 pass / 0 fail / 2461断言**，23.53秒，`/tmp/awa-mist-victory-related-final.log`。新八项独立门禁 `8/0/192`，`/tmp/awa-mist-victory-tests-with-failure.log`。root check（两端及后端测试类型）、必要格式和diff检查通过，`/tmp/awa-mist-victory-types.log`。本批只改测试计划／断言，不复用旧阶段输入指纹声明全量验收。

下一步新角色双语实际 SDK／ACP／MCP 完整及严格失败通路，并按 runtime-resources 落实精确请求预算、到达／真正迟到与物理回收；再做固定种子受限观察者和实际前端回放。离线完整局不等于这些门槛已完成。
