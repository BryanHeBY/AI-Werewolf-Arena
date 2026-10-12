# 动物梦境原生十二人：交付契约

实施范围为[联合规则卡](rules/awa-animal-dream-twelve-v1.md)中的白猫、子狐、河豚，以及此板熊的天亮取样、狼美人封锁、完整死亡链和狼优先判胜。其它混搭不受支持；旧熊板省略 `signalPolicy` 时仍保持原夜初取样。

## 配置

`configs.example/boards/twelve_player_animal_dream_{wait|skip}_{first|final}.json` 是四个可运行、可 roundtrip 的完整预设，同名 `games/` 示例使用现有示例 Agent。没有修改用户 `configs/`、认证或模型配置。

| 参数                                | 默认与另一选择                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `roles.white_cat.skippedVotePolicy` | `awa_wait_for_actual_exile_v1`：跳票不计到期单位；`awa_expire_on_skipped_day_v1`：自爆结束白天也计单位 |
| `roles.pufferfish.ballotPolicy`     | `awa_final_ballot_v1`：最后完成票轮；`awa_first_ballot_v1`：始终首轮原选民                             |
| `roles.bear.signalPolicy`           | 本板固定 `netease_dawn_live_v1`；旧板可省略或显式 `awa_night_open_v1`                                  |

参数读取、逆写、公共预检与直接 bootstrap 共用有限板资格。未知字段、额外角色、错数量、规则冲突均拒绝；新 Dawn 不能绕过限制用于旧熊板。错误码进入配置 CLI 的安全白名单。

## 执行与所有权

- `animal_dream/roster.ts` 锁定原 World、原身份、Role/Camp/Alive、私库及胜利归属。观察到替换或非法复活后永久撤权。
- `authority.ts` 唯一拥有三库存、真实夜和放逐单元、原接受票轮与待提交效果。`state.ts` 只做纯状态运算；`requests.ts` 和 `request_envelope.ts` 绑定当前请求及最早截止，SDK、ACP、runner 沿用同一授权。
- 子狐在 N2 起明确决定，非 null 只消费一次；命中狼取消整队当夜刀，命中美人同步清关系。狼聊保留；本人不获命中或阵营结果。
- 白猫先过滤首次致死，真实 Alive 及版本保持；同单元首次延期留到下单元，后续攻击不续时。到期加入新来源，只有当次新放逐或反击源可以与到期合并。
- 河豚从首轮或末轮完整接受票获取原选民，1.5 仍是一人；只提交 boolean，不得选子集。主动与刀死被动独立，死亡提案、遗言、徽章、追加魅惑链全部结束才判胜。
- PhaseManager 保留阶段和最终胜负；DeathResolution 唯一写生命。异常或正常取消早返都封口，不退款、不伪造普通结束。

## 玩家知情、展示与录制

13 类共享严格事实区分公开翻牌、本人选择/通知和 God 结算。事实通过原生数组槽位实际追加并冻结后，才推进发布知情缓存。Observation 与动态 prompt 共用该缓存，初始化及规则说明有中英文本。

夜来源波在白天公告时，`payload.phase` 是来源、复盘 envelope phase 是公告阶段。两种公开翻牌仅产生 role reveal；God 提案/实际波/到期/单元事实不改变前端 Alive，公开真实死亡事件负责更新存活。河豚反击翻牌只允许 Voting。

录制保留原体、canonical 库存和准确请求/结算/操作游标。独立账本从原始动作、接受票、首轮 PK 候选、实际单位、原座位和公开前缀推导结果；不调用运行 owner、投票器或死亡 reducer 做期望。狼队原受众按发布时活狼冻结，历史不会补给他人。

成功、必答失败、迟到和更正记录均通过精确 Tape。付款后记录通知失败可保存已 settled 但未发布的真实失败前缀，不能补知情或死亡；未列入现有 faultPlan 的 I/O 注入不冒称可离线复现，Tape 保持明确 mismatch。

## 验收与后续重构

[本轮验收](reviews/p9e-animal-dream-acceptance.md)记录独立审查、原红例、真实通路、四政策固定种子、实际档案/浏览器、完整同源门禁及提交范围。完整门禁通过后才登记三角色 implemented。

用户于 2026-10-12 暂停原 P1–P10 长期目标，随后明确要求这三个角色完整交付再收口。完成本卡后停止；禁言长老、乌鸦、典狱长、P9f 余项和 P10 保持暂停。后续重构应保留本轮字面脚本、原体/资源/受众、PK/延期时钟、失败前缀及纯逐帧投影的回归约束。
