# P8 丘比特功能审查

[来源策略卡](../rules/sourced-cupid-v1.md)冻结网易2017与Lui-même两个实际分歧版本；首批只开放13角色有限City组合。丘比特登记implemented，整体P8–P10及用户最终验收仍开放。

## 独立审查与修正

- R/L/D（policy_review）：请求构造后重新检查scope；玩家DTO读取数据描述符，拒绝外来getter。复查又发现共用对象reader拒绝数组，合法情侣ID也被抹去；采用专用数组descriptor读取并补合法choice、两种策略与双语提示正向断言。真实阵营/刀权与胜利归属分离；无底牌/关系组泄露。原审查者独立5项/34断言复查关闭。
- A/T（fox_chain_review）：初始死亡关系扩张之前检查isCurrent，取消不会消费关系或发布事件。外部纯Lovers/空源致死种子也触发关系，循环派生方不反向禁根Hunter枪；原审查者独立49项/353断言复查通过。
- A/T/L/D（p8_delivery_review）：双方原生命current才投影当前关系/禁互投，旧通知按历史actor保留；新增Hunter→情侣WolfKing→再枪的实际追加波次；受限ObservedBot与World基线分别计数。空目标shoot主动null通过统一枪流程。独立68项/620断言通过，原三项缺口关闭。

上述问题均补回归，不把初轮失败改写为通过。两个来源未给复合死亡完整表，双方独立同波死均禁技能、Night梦与殉情闭包及遗言兼容均明确标注工程补全。原AWA狼美人默认现在也抑制Lovers，来源卡/历史契约同步，旧板子没有情侣所以行为保持。

## 实际接入与人工预期

10手写场景×本机SDK/ACP-MCP/混合×中英＝60完整局，逐决策/checkpoint/事件/终局严格Tape与人工获胜/存活ID核对，检查进程与会话回收；无真实模型请求。覆盖双来源人狼/双狼情侣、根Hunter枪、殉情Hunter禁枪、双方独立死因、Night梦链、Beauty毒+殉情抑制及追加枪波。目标、死亡来源、关系、身份、Victory归属或生命在await后变化撤销晚响应；首夜提交world栅栏防止重入。

12板×20固定seed×双语＝480受限观察机器人局，全部自然结束，reject/fallback皆0，逐局录制与严格Tape。实测480选择、960互认、414殉情、276Hunter枪及24WolfKing枪；没有把策略actor持有World的1200局（12×50×2）基线回归算成受限观察证据。分支报告 `/tmp/awa-p8-cupid-observed-branches-{board}-{locale}.json`。

4份真实God档供前端夹具，9新增单元/8新增Chromium检查双来源成员、已死Cupid胜者、根Hunter与梦链、studio/shared video frame字幕及座位。完整前端238项/2315断言/34文件与Chromium96项皆通过；browser无跳过/flaky/重试，截图 `/tmp/awa-p8-cupid-{zh-CN,en}-browser.png`已实际查看；获胜徽与原始玩家名分行展示，避免文本连在一起。没有声称MP4导出。

## 最终源码门禁

冻结源码为main基线 `f843b08ba2e3b658461edd32de3b35be04ad673e` 加本批功能差异，sourceHash `20dee8c00a0483479f1d62d4c4444f36fb8609d7d2d42519317f29a25c12810e`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`，指纹由currentEngineVersion与实际reproduction生成。sourceHash覆盖既有core/game/app和共享包TS，不冒称覆盖AI/runtime/前端/所有物理文件；本提交保存完整差异。指纹后没有再改后端功能源码。

最终完整后端四组216文件并集：2551通过/0失败/226151断言；各组736/584/588/643，均exit0，最长426.36秒。清单 `/tmp/awa-p8-cupid-verified-backend-manifest.json`，命令/状态/日志 `/tmp/awa-p8-cupid-verified-backend-{1..4}.{log,status.json}`。包含Seer真实三夜默认Tape、摄梦/狼美人全部历史策略、60实际Cupid通路与480受限观察局及1200World基线。最终定向53/554通过。此后只写门禁文档，没有仅扩测试再冒称同一全量。

最终前端238/2315/34文件exit0；CSS获胜徽/玩家名分行修复后全量Chromium96/96、0 skipped/unexpected/flaky、单worker零重试，JSON `/tmp/awa-p8-cupid-verified-browser.json`，截图已再次查看。日志 `/tmp/awa-p8-cupid-verified-frontend-tests.log`。根check、lint、format:check、前后端build与git diff --check皆通过；日志按同一verified前缀，既有>500KB bundle提示保留，没有改严格检查或超时。

初轮 `/tmp/awa-p8-cupid-backend-*` 的23项失败均因旧测试把已启用Cupid当planned；改为真正未启用的awakened_knight，未删拒绝测试或放宽生产校验。随后final-backend全量2550通过后，独立复查发现合法choice DTO漏投影；修复、补正向断言后重跑上述2551的verified完整门禁。因此前两轮日志保留历史，最终结论只引用verified。

本轮还再次运行 `bun --no-env-file backend/scripts/check_seer_baseline.mjs`：eb4f026实际请求min=1/max=1、required_any_tools=[check_identity]，与当前默认一致；输出 `/tmp/awa-p8-cupid-seer-baseline.log`。摄梦/狼美人来源版本与八类当前行为继续按各自契约复核，不用重新网页超时替代实现证据。

没有push、部署、秘密/用户configs读取或系统设置修改。源策略/本批功能完成不表示P8剩余角色、P9/P10或用户总体验收完成。
