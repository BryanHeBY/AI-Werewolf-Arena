# P5 狼王交叉审查

## 范围

[冻结卡](../rules/awa-wolf-king-v1.md)与[接入契约](../wolf-king.md)：第八项实际角色，普通狼队/自爆权限与独立死亡枪、共用单枪机制、角色级同名工具校验、明确死亡stage/事件、两语私有信息、六/十二样例、真实完整局/严格Tape、受限模拟与前端帧。只完成P5狼王，白狼王/骑士/守墓人及后续56项不提前登记。

## 主代理实际门槛

- 核心12／327（含真实PhaseManager末狼普通自爆）及既有死亡基础48／712，类型与source scan通过。两板example配置2／10，拒未声明变体与计划角色。
- 五种人工场景×SDK/ACP/混合×中英，共30实际完整局与逐局Tape：15／3867，日志 `/tmp/awa-p5-wolf-king-wire30.log`；审查加本人身份/弹药和他人负断言、显式每轮日次后15／3967，日志 `/tmp/awa-p5-wolf-king-wire-markers.log`。本机合成模型只替决策，生产runner/factory/SDK/ACP/MCP和资源回收均真实。
- 两板各12受限观察seed，24局自然结束/零修复/实际枪分支，每局严格重放：2／34，日志 `/tmp/awa-p5-wolf-king-simulation.log`。
- 初版全release664／38687／95文件，type/deps/boundaries/i18n/test/smoke全部通过，日志 `/tmp/awa-p5-wolf-king-release.log`。包括原50＋新30＝80实际双语通路完整局/Tape；不是80个外部模型局。
- 前端69／560/types/build通过，日志 `/tmp/awa-p5-wolf-king-front-final-{tests,type,build}.log`；真实Chromium12交互（含两语实际完整六人档案枪链）通过，日志 `/tmp/awa-p5-wolf-king-e2e.log`。
- 实际两语Remotion frame2080的 `/tmp/awa-p5-wolf-king-{zh,en}.png` 已目视：独立狼王标签、正确死亡前缀、未提前winner，原姓名不翻译，英文不误叫Hunter。输入为实际SDK游戏档案；本次未改编码器，不重复无变更MP4编码，以实际PNG/Player和已有P3/G04视频管道证据验证新画面。

完整局helper初版配置envelope/玩家文件路径与零行动懒会话断言有夹具错误，已使用现有严格格式/正确路径，并对零行动ACP明确无trace而不伪造PID。隐私反例初版用数组索引误取换号后的另一玩家，已改稳定player_id查询；保留第二夜四类狼队事件负断言，不放宽授权。严格记录的day/stage/完整最终action逐项核对字面计划。

## 三路发现与修正

| 审查路 | 关注/发现 | 修正与证据 |
| --- | --- | --- |
| A / review_arch_tests | 共享枪/角色资源、同名工具优先级、permit/中央波次、真实夹具及PID；建议actual wire身份/枪私有state正负断言、日次 | 角色profile优先路由，显式全轮日次；scenario提供独立marker，King SDK系统/ACP初始化确认本人牌，每轮弹药1，其他演员禁止私有计数；30实际局更强断言通过 |
| R+T / review_scope_rules | 官方/赛事版本，互认措辞/核验日期、resolver不能冒充判胜；五场景人工波次与字面oracle | IDs-only/非具体狼牌明确，2026-10-08日期补齐；resolver测试名精确，真实PhaseManager/runner判勝闭环。独立core12／327，规则及oracle0阻断 |
| L+D / review_i18n_delivery | 两语、新旧stage/事件、秘密resource/公共shot、Native shoot API默认语言、源码例外与现行目录 | native shoot描述英文角色中性但旧路径保留；主动协议/hint双语不变，61→57现行例外、8已交付/56planned目录同步，迁移边界明确 |

系统提示新增日次改变实际执行源码指纹，最终完整门禁重新生成与重放，不将初版green替代最后修正后的证据。三路最终复查与门槛在提交前收尾。

## 最终复查与提交门槛

最后源码完整release664／38789／95文件及smoke全部通过，日志 `/tmp/awa-p5-wolf-king-final-release.log`；原50＋新30实际双语完整通路与全部Tape都按最后指纹重新执行。没有在游戏运行中修改生产源码。显示源码未因Day提示改动而变化，复用同批实际Chromium12／两语PNG与front69／560/types/build证据。

三路最终0剩余阻断：A独立core+config14／337，核对marker15／3967与final全门槛；R独立core12／327，人工核算五场景并复核day只展示原请求数据；L独立core+config14／337与front2／20，关闭Native API/default language、现行57例外及8／56目录问题。代理未重复完整矩阵、浏览器或外部模型；主代理实际门槛与代理审查分开记录。

新角色可在本卡/已验板子范围登记verified；P5其它三角色、P6–P10及真实外部模型发布评测继续。全部changed本地文档链接与git diff --check通过。
