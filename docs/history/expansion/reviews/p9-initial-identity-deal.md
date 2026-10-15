# P9a 共用初始身份物理牌底座

基线 `492fc8f`，main 线性开发。将原 Thief 物理发牌、所有权、setup 状态、实际夜 commit 提取到 `roles/initial_identity/deal.ts`；closed kind 仅 Thief/Shapeshifter。没有注册 Shapeshifter profile、配置或选择窗口，本提交不是千面人功能交付。

旧 Thief API 仅识别 Thief owner，原物理牌算法、policy、投影字段、optional/两Wolf必选语义和错误码保持。其他 owner 不能通过旧接口读取、选择、关闭或登记夜 commit。Night、PM 与狼队知识改为共用门禁；未接入的非 Thief pending handler 在阶段/事件修改以及 maxDays 判定前拒绝。既有 gameOver 返回和 Thief maxDays 封盘行为保留。

三组只读审查各独立 55 pass/718 断言；入口排序例外已修复，原审查者复验新边界 3 pass/27 断言及真实 Thief maxDays=0 probe 闭合。无需改变已冻结规则或目录状态（23 verified/5 implemented/36 planned）。

冻结 sourceHash `3efbdd49946f47bdbe82a28ede03e41ab28e5119a1879401a23b225482cb9174`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。最终受影响六文件 **176 pass/0 fail/19137 断言**，100.74 秒，含 Thief 90 实际 SDK HTTP/ACP 子进程 MCP/mixed 双语完整局逐严格 Tape、200 受限机器人逐 Tape、8 实际严格失败 partial Tape、全部 Thief/WildChild 核心和 wolf-team 权限回归；日志 `/tmp/awa-p9-initial-deal-regression-final.log`。源码在这轮冻结。早轮 172 pass/1 fail 是运行期间修改 PM 触发 sourceHash incompatible，保留 `/tmp/awa-p9-initial-deal-regression.log`，不算通过。

root check/lint/format:check、后端 build、git diff --check 全退出0，日志 `/tmp/awa-p9-initial-deal-{check,lint,format,build}-final.log`。本次只覆盖共用底座所影响的离线回归；没有拿上一 WildChild 全量门禁冒当前源码的全量证据。下一步共用 opaque 授权窗口及千面人独立 mustChoose/allowedSlots、完整录制/展示，P9/P10 和用户最终验收持续开放。
