# P9a 野孩子榜样死亡与次夜狼队验收

原目录main线性接规则冻结490fa53；唯一 `awa_lui_meme_wild_child_v1`，来源为发行商Characters印刷16–17页。基础七角色+WildChild、City有限支持；不自动开放Thief/Cupid/事件包/其它扩展。标准N牌，原WildChild/Good民边，一次首夜必选其他活人，不窥榜样身份；榜样实际淘汰后转真实Wolf阵营/胜利，Role仍WildChild，实际下一Night才获得狼队互认/chat/knife。孩子无自爆，原Wolf配置不变。复合死亡波次/生命周期等明确AWA工程补全，见[规则卡](../../rules/awa-lui-meme-wild-child-v1.md)。

## 全链与关键边界

schema/default/apply/serialize→原始roster→private独立资源→唯一factory请求与三处deadline克隆→实际Night/DeathResolution→gateway晚验证→双语每轮提示/ObservedBot→玩家白名单DTO/God事实→严格录制/Tape→终端/前端/shared video frame已贯通。6/12公共板样例显式选唯一策略，标准N玩家，不新增底牌。

榜样绑定原玩家生命；榜样后续role/camp变化不换关系，外部复活/Alive新对象不能兑现旧关系。只接受引擎实际死亡commit，整组pending先全部mark再在遗言/徽/枪await前转换；两Hunter不同root同追加wave同时打榜样/孩子，两顺序都不转阵营。榜样首波死、孩子活时先转，后续Hunter枪杀孩子以Wolf死亡且不activation。转换同步更新Role.camp/Camp/Victory，在完整Judge前已生效；最后原Wolf榜样死不会提前封Good。

权限查询无activation，进入eligibleNight及之后首个实际Night才一次启用；跳夜也如此。普通Night/PM Day/Voting递归在变phase/events前拒绝。不补旧狼队私有史。实际active孩子死后保原互认身份，但不能聊天/刀；复活/换生命撤销。choice/actor状态/config/victory或getter被篡改都撤权，访问器零执行。实际刀被守/解药救回、Idiot放逐免死不触发。

God榜样死亡事实含完整实际deadIds/死因/commit；本人只choice/变身/activation lean事实，变身只actor/day/eligible/camp，不暴露God因果token/隐藏毒因。前端接受完整God与严格本人schema，按实际时间只改camp，不改Role/Alive/徽/公开翻牌。

不可变初始roster修复普通N局当前阵营覆盖replay初值；原始WildChild/Good被保留，只有对应事实更新camp。record validator既核严格六字段资源/每checkpoint与状态因果，也对照原始choice decision、原生night_resolved/voted_out/self_destruct/hunter_shot及最终night damage logicOp建立actual root/wave/cause图。同步伪造榜样事件/checkpoint甚至克隆decision仍因原生死亡不一致拒绝。live未finalized录制尚无operations，只验证已存在原生事实；最终完整/失败Tape强核实际logicOps，不能把实时flush当完整档。

## 实际验证

核心47测试/309断言：mandatory/缺失/非法、13晚撤权、3榜样getter、opaque跨World/截止、五实际死因、完整同波/双Hunter两root顺序、晚枪、原主体/生命/角色更换/复活、无历史补知、最后原Wolf判胜、PM实际次夜/reentry和3实际存活分支。

6人7剧本（wolf_exile/good_knife/poison/hunter_chain/same_wave/self_destruct/model_alive）与12人3剧本（wolf_exile/good_knife/hunter_chain）×SDK HTTP/ACP子进程注入MCP/mixed×双语=60完整局及逐strict Tape；每轮当前阵营、原始Role/Good档、God因果不进入玩家、Night1无pack历史、Night2实际刀、孩子无自爆请求及9类坏档验证。8实际SDK/ACP×双语严格失败partial Tape均无fallback/后续native动作/转换，失败窗口closed。

5有限板×20固定seed×双语=200受限ObservedBot自然终局/每局Tape，0reject/fallback；独立World5×100×2=1000自然终局，788转换/678次实际后夜activation。两类证据分别保存，不以World真相替代玩家观察。

四实际God档6wolf_exile/6hunter_chain/12good_knife/6same_wave进入frontend fixtures；10新增reader/双语actual archive/frame单元。8新增实际Chromium用例与双语12人PNG，最终frame有字幕的+15时点；主代理已打开两张实际PNG目检，12人座位/原榜样死亡、孩子仍存活且保WildChild身份/Wolf阵营、双语变身与次夜入群字幕一致，无遮挡。没有MP4/T6商业模型质量声明。

三组只读审查修复原资源getter、死亡后互认丢失、lean本人事件没有Godtoken导致丢标签、同一致伪造model/cause被接受；原审查者独立probe复验全部闭合。delivery独立47/309、前端10/81；policy独立2/10；chain真实死亡/复活/替换权限probe和47unit闭合。

## 冻结源码最终门禁

基线490fa53，sourceHash `61c9ef824bc17a65477c6ae37f5ced8a9da4abd6144dfa94825a44683e8307f7`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。hash覆盖core/game/app及共享TS包；commit保存其余AI/runtime/frontend与测试。生产冻结后仅补前端测试和文档，不改生产源码；后端229文件按四互不重叠组各执行一次，分别791/665/782/694通过，各退出0；合计 **2932通过、0失败、281583断言**，356.79/391.69/459.57/283.41秒。完整源码与lockHash相同，原断言与生产超时未放宽。

前端277通过/0失败/2696断言/42文件；root check/lint/format:check、双端build、git diff --check实际退出0（已有bundle>500KB提示保留）。完整Chromium **128通过、0失败/跳过/flaky**，单worker、零retry，显式退出0，86.48秒。不把中止/失败轮算通过：首轮oracle漏Seer死目标和自爆hooks、二轮自爆另一Wolf同窗漏null响应、finalized logicOp过早用于实时flush、getter测试误expect rejects而实际安全false，以及运输测试进行中生产改变触发hash不一致；均保留旧日志并在冻结源码最终组重跑；浏览器一轮无完成报告不计数，下一轮126通过/2失败是原始index误选被presentation过滤票记录后的事件，改按精确事实label定位并断言当前帧与Good→Wolf class后完整重跑128通过，不放宽生产超时/断言。

最终清单 `/tmp/awa-p9-wild-child-verified-backend-manifest.json`，四组 `/tmp/awa-p9-wild-child-verified-backend-{1..4}.{log,status.json}`，汇总 `/tmp/awa-p9-wild-child-verified-summary.json`；前端 `/tmp/awa-p9-wild-child-front-first.log`，最终浏览器 `/tmp/awa-p9-wild-child-browser-complete.{json,status.json}`，静态/build `/tmp/awa-p9-wild-child-{check,lint,format,build-backend,build-front}-final.log`（前端脚本修正后另check/lint-last）；Observed十份 `/tmp/awa-p9-wild-child-observed-{board}-{locale}.json`，1000World `/tmp/awa-p9-wild-child-world.json` 与重跑 `world-final.log`，6/12样例 `samples.json`；十实际God档 `/tmp/awa-p9-wild-child-{size}-{kind}.{record,replay}.json`。不触碰用户configs/秘密，未push/部署/真实模型，仍待用户最终验收且P9/P10继续。

WildChild登记implemented，目录 **23verified/5implemented/36planned**；不是来源全部组合或P9/P10完成。下一项千面人的三组来源/规则审查已关闭冻结前缺口，后续立即接续；整体等待用户最终验收。
