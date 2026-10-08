# P4 G04 胜利记录与展示交叉审查

## 范围与证据

接续[核心审查](p4-g04-core.md)。本批将封盘事实写到 manifest.game_result/public result.decision；共享严格 reader 和中英 formatter，贯通终端、审计、工作台、时间线、席位和按 frame 的 Remotion。契约见[胜利记录与展示](../victory-record-display.md)。不将合成个人／关系目标作为已实现角色。

- 最终后端 release:check：633测试／34433断言／91文件，types、deps、边界、i18n、全测试与 smoke 均通过。日志 `/tmp/awa-p4-outcome-public-serial-release.log`。包含50实际本地 SDK／ACP／混合双语基础与单窗口完整对局和逐局严格 Tape；生产 finalizer 的主档及 public decision 与真实封盘相等。
- 主档专项16／139：两语五种结果实际落盘，清理失败不覆盖胜利；投影／成员／访问器／非枚举／复制时变更及 header-terminal 冲突拒绝，坏 plain JSON terminal 保 raw。日志 `/tmp/awa-p4-outcome-public-safe-clone.log`。
- 前端最终67／539，types/build通过。日志 `/tmp/awa-p4-outcome-roster-{tests,type,build}.log`。包含无提前席位获胜、死亡获胜者仍 dead、旧档不猜名单、terminal-only 合法胜利，以及未知玩家999在摘要／时间线／帧／席位的一致 Unknown。
- 实际 Chromium 最终10项通过，日志 `/tmp/awa-p4-outcome-public-roster-e2e.log`；原有交互和两语个人＋关系胜利、两语非法成员在实际工作台／视频帧验证。
- 实际 Remotion 中文 `/tmp/awa-p4-victory-zh-final.png`、英文 `/tmp/awa-p4-victory-en-final.mp4`（H264、1280×720、6秒）及抽帧 `/tmp/awa-p4-victory-en-final-frame.png` 已目视检查。姓名原文保留，句子没有重复 wins／获胜和名单，判定点独立；日志 `/tmp/awa-p4-outcome-public-final-{zh,en}-render.log`。最终 roster 检查不改变此合法夹具的画面，浏览器与单测验证最终路径。

早期并行视频渲染时全测试有一次十二人25 seed批量场景超过 Bun 默认5秒；没有业务断言失败。停止渲染后的最终原门禁完整通过，未放宽断言或重放规则。前端类型检查发现移除 footer 名单后未使用的 import，已清除。早期 green 不替代以下独立审查发现后的修正。

## 三路审查与修正

| 审查者 | 发现 | 修正 |
| --- | --- | --- |
| A / review_arch_tests | 校验原输入后返回另一 clone；header／合法 terminal 不一致；坏 typed getter 经 clone 实体化；未知成员的 label 与 seats 矛盾 | 返回实际副本再验；完整 decision 一致；显式 terminal 图用迭代 own descriptor 检查、拒访问器／非枚举、cycle guard；实际所有 label 路径传全局 roster，坏 JSON 原文保留但 Unknown |
| R+T / review_scope_rules | decidedAt-only 坏事实在 console 回退旧阵营胜利 | outcome OR decidedAt 判别与严格 reader，双语 judge/live Unknown 反例；帧时点、dead winner、null个人／组投影、旧无名单不猜均保持 |
| L+D / review_i18n_delivery | 非枚举 decision 可静默丢；未封盘 runtime_error／timeout 误作 no_winner；英文 reason 文案精度 | 显式与 nested serialized 字段拒非枚举；无终局失败显示未结束；Decision reason 两语一致；审计共同提示明确 decision、兼容 null 与执行 reason 的不同语义 |

审查结论以最终复查为准；各路使用独立轻量判例／probe，不将其声称为代理运行浏览器、编码或完整 Tape。主代理承担上列实际门槛。

最终三路0剩余阻断：A独立record16／139与front victory13／172，R独立record14／123与front11／154后关闭原console问题，L最终独立record16／139与front11／154并逐调用复查roster。所有发现已修正并复查；G04完整记录与呈现交付，P4整体验收登记另笔。
