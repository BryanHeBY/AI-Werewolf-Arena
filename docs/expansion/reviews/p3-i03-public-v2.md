# P3 I03 公开复盘 v2 交叉审查

日期：2026-10-08。范围：共享版本契约、旧无版本/1转换、后端writer/export与浏览器reader、游戏locale元数据。

| 代理                       | 首轮发现                                                                             | 修正及最终复查                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review_scope_rules` R/T   | 声明payload路径宜纳永久回归；新增source guard的resolve/join对绝对形状sessionId不一致 | 中英phase_changed/god初始资料正式回归；guard使用resolve(join(...))同reader语义，原路径/软硬链接和/legacy回归均保护源字节。独立FS复现及9测试47断言，0阻断         |
| `review_arch_tests` A/T    | runner/reproduction locale输出建议直接核验                                           | actualRunner manifest/public locale与schema2断言；真实sim→动作复现输出locale，English仍明确gate。21测试194断言含50局完整复现；最终核查/legacy测试确实落盘，0阻断 |
| `review_i18n_delivery` L/D | 当前工作名不能持续充当历史角色别名；payload英文路径宜覆盖                            | 128角色别名literal历史快照、append-only政策；中英路径原话保护回归。后续路径修补交叉复查0阻断                                                                     |

## 验证

- 后端release283测试0失败；类型/依赖/边界/真实SDK/ACP/MCP/完整对局/模拟/内部复现/烟测通过。
- 前端类型检查和34测试通过，实际browser loader与backend exporter读取同一旧合成fixture。
- 版本协商在先；未来/畸形version拒绝，v2只clone不反推legacy文字。输入对象和旧源文件不改，转换后的v2重复读取稳定。
- 人工oracle核对已声明路径：phase/stage、role/camp、结果、phase_changed和god初始players；未知ID和值、名字、任意nested payload和与原因同形的夜聊/玩家原话不译。
- 新writer仅带已提供locale，不含private random/engine/auth信息；实际执行元数据明确传播，未知旧locale不猜测。
- source原路径、同inode hard/soft link及绝对形状sessionId拒绝，7迁移测试44断言，源字节保持。
- 内部Tape继续严格hash/RNG/引擎政策；旧公开档继续reader兼容，不混两种承诺。
- 没有外部模型调用；私人turn/request消息与I04仍后续，英文runner和内部英文复现gate均未提前开放。

三路最终复查剩余阻断：0。
