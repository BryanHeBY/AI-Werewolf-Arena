# P9a 盗贼真实发牌与身份选择验收

本笔接在规则冻结 `17fd377a3dcd87e85d04a890659460c5f9d2d27e` 后，原目录 main 线性实施。唯一策略 `lui_meme_thief_two_extra_villagers_v1`；来源与有限支持条件见[规则卡](../rules/lui-meme-thief-v1.md)。N配置牌加两普通Villager、真实N+2随机发牌/留底，两Wolf必选，其它组合可保留；来源不支持的组合不会因角色目录已启用而自动授权。

## 完整链路与边界

strict角色参数/原N公共定义→实际N+2一次deal RNG→完整原始metadata与物理card ID→第一夜普通技能前唯一选择窗口→原生Role/Camp/Victory新实例→本人提示/独立DTO→实际SDK/ACP/MCP→God录制与strict Tape→前端及共享视频frame已贯通。Thief或神职都可能落底，不重抽/保送，保留Thief真实Good民边且没有复制技能。选中slot换成原物理Thief牌，另一slot不变；人物座位/姓名/生命/徽/票/Agent与会话历史保留。新Wolf首夜互认/刀，新Seer/Witch/Guard首夜真实执行，新Hunter首夜真实死亡枪。

原始整个发牌授权绑定原玩家生命/Role/privateState/Camp/Victory，原底牌/hand/reserve对象及字段，整局一次窗口、config/phase与opaque factory request capability。三处真实deadline-only克隆继承此权威，跨World/请求篡改拒绝。构造、发送、await及gateway后终验，撤权无换牌；新身份/库存先准备，再同步提交。失败/取消窗口永久关闭，普通夜间不能跳过；夜间及Day/Voting递归PM均在状态/事件改变前拒绝，下一实际夜不重选。

God原始deal和checkpoint保原完整N+2；初始pending/null、后续不回退/改选、真实物理牌主/槽/原始多重集与当前身份阵营严格检查。损坏的原卡位置不再投影库存。公共只给N+2候选计数和实际N人两底牌未知说明，只有本人能看两slot/选择，其他玩家没有私有事实。新玩家视图沿既有view-local provenance，不泄露隐藏God行数。

录制的replay初值恢复原始Thief/Good，由实际私有选择事实在对应时点改角色/阵营，不改alive/徽或公共明牌。Tape生成归档同口径；共享reader、终端、前端和video frame按严格事实消费。初始系统身份/队友介绍明确是会话建立时历史状态，后续每轮当前身份/阵营/库存/名单为准；原有“真实身份是/your true role is”字面兼容保留。

6/12公共样例 `configs.example/boards/lui_meme_thief_{6,12}_v1.json` 保N roleSetups和显式策略，初始化实际N+2。用户configs与秘密未读写。

## 实际验证与独立审查

52核心/失败Tape/公共样例测试：真实N+2与旧deal RNG、随机Thief/God落底，双Wolf两slot强制/缺失/非法，一Wolf可保留，15类late scope撤权、初始外部改牌、phase与原异常、两World/opaque factory/deadline、getter-free raw tool、新七基础身份原生资源/配置、首夜0原Wolf不早判胜、Day/Voting递归及次夜不重选，完成后卡主/槽篡改不投影。

6人11种：双Wolf两个slot、单Wolf+God保留/选Wolf、Seer/Witch/Hunter/Guard/Idiot/Villager、Thief落底；12人4种：双Wolf、保留、Seer、Hunter。15板×3真实本机SDK HTTP/ACP子进程注入MCP/混合×双语=90完整局及每局strict Tape。每轮提示断言当前身份，新神首夜实际阶段、Hunter首夜枪/原生事实、只有本人选择事实和初始/最终角色录制均验证；篡改全deal长度/多重集、初始角色、cardID、slot、camp、cycle0及后续pending均拒绝。

另8条实际SDK/ACP provider严格失败及partial Tape覆盖非法预算耗尽和无动作，双语均零fallback/native后续请求/换牌/选择事实；失败checkpoint关闭窗口、保原物理牌和角色。它们是注入模型决策的实际provider链，不冒称真实商业模型质量。

5有限boards（six/twelve/Guard/Idiot/Sheriff）×20seed×双语=200受限ObservedBot自然终局，0reject/fallback，每局录制与strict Tape。独立World基线5×100×2=1000自然终局，196Thief落底、804选择、34两Wolf底牌；两类证据分别保存，不以World真相替代受限玩家。

四个实际God档（6-Seer/6-Hunter/12-Wolf/12-保留）进入frontend fixtures，9新增单元与8实际Chromium覆盖初始/选择后身份、原alive/徽不变、shared video frame和严格坏事实。两张中英12人实际PNG由主代理目检，字幕已显现的+15frame与座位角色/阵营一致。没有MP4/T6声明。

三组只读审查修复并原审查者复验：PM日间重入先改phase、原物理卡主置换被投影、cycle0伪造complete与后续pending倒退、前端initial_deal绕strict reader、replay初值被最终角色覆盖。所有报告项闭合，来源审查未发现有限规则偏差。

## 冻结源码最终门禁

主线基线17fd377，sourceHash `7b36967e3d3c9e2307e687adfee77473ad650264970cf55e209336be544a5aac`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。该hash覆盖core/game/app及共享包TS，完整本地commit保存AI/runtime/frontend与测试差异。生产冻结后仅补第四组尚未执行的失败Tape/样例测试和文档，不改生产源码。

后端完整225文件按四个互不重叠组执行，分别710/686/666/772通过、退出0；合计 **2834通过、0失败、266021断言**。各组343.08/381.43/207.90/239.92秒，均为同一冻结源码/lockHash。

前端 **267通过、0失败、2601断言、40文件**；Chromium **120通过、0失败/跳过/flaky**，单worker、零retry，230.61秒。root check/lint/format:check、前后端build与git diff --check结果 全部通过（退出0）；已有500KB bundle提示保留。

最终四组清单 `/tmp/awa-p9-thief-verified-backend-manifest.json`，日志/完成状态 `/tmp/awa-p9-thief-verified-backend-{1..4}.{log,status.json}`；汇总 `/tmp/awa-p9-thief-verified-summary.json`。前端 `/tmp/awa-p9-thief-front-final.log`、浏览器完整JSON `/tmp/awa-p9-thief-browser-final.json`；静态/构建 `/tmp/awa-p9-thief-{check-last,lint-final,format-final,build-backend-final,build-front-final}.log`。1000World `/tmp/awa-p9-thief-world.json`；200Observed十份报告 `/tmp/awa-p8-thief-observed-*`（文件前缀沿测试模板保留，但内容为Thief），各局录像/Tape在记录目录。

首轮核心缺导入、两个测试对Seer默认省略/周期Voting结束的错误预期已修；首轮Hunter transport断言误把hunterId写成actorId，按原生事实修正。首个全量前端发现新事件缺stage名；早期后端发现修改初始身份句破坏旧角色字面提示oracle，保留原句并加历史语境后定向5实际SDK用例复验。两个早期完整组以-15明确中止并保留 `/tmp/awa-p9-thief-final-backend-*`，不计通过；最终verified四组全部重跑。录制/游戏失败用例没有放宽生产超时或断言。

盗贼登记implemented，当前23verified/4implemented/37planned；并非发行商全部组合或P9/P10完成。P9a其余角色与后续各波次继续，整体仍待用户最终验收。本批仅本地commit，未push/部署、无branch/worktree、无真实模型、用户configs/秘密或系统设置操作。
