# P8 咒狐功能审查

规则：[来源规则卡](../rules/netease-cursed-fox-v1.md#cursed_fox)。新角色注册为implemented，功能闭环与本批门禁完成；P8阶段、剩余40角色及P10仍在实施，不关闭总体用户验收。

## 独立审查与修正

- R/L/D（policy_review）：2026网易正文与2021官方搜狐正文支持普通刀免疫、预言家/幸运儿致死、魔镜不致死、摄梦保护及全灭独胜。保持Lucky不能查自己，局部角色组合双方校验；补最后Good死独胜、已付费施法者首次死亡/复活与内部重复City拒绝。原审查者复查全部关闭，无阻断/高风险。
- A/T/L/D（p8_delivery_review）：旧请求只在投影前检查身份仍可能被inspectionLabels回调替换身份。原生及Lucky在最终提交条件再核验相同identity snapshot；两个回归证明旧响应无报告/claim/消费，合法新请求可重试。独立21测试/71断言通过，复查无新增阻断。
- A/T（fox_chain_review）：已付费查验后中断，同日重入会丢失瞬态claim；新增world/day提交栅栏明确拒绝重入。首日竞选先于实际夜死，竞选窗口换身份会承受旧查狐死亡；延续phase-independent目标身份绑定到实际settle，逐项移除FoxInspection，保留独立poison。实际pipeline与真实竞选窗口回归均通过；原报告者独立21/71复查关闭。

不在纯resolveInspection中制造副作用。核心伤害只接收生命/身份绑定的效果与有限普通刀免疫对象，实际动作提交后创建claim；PhaseManager在完整死亡链后替换独立目标胜利。God保留因果来源，玩家投影没有额外查狐/免疫事实。现有枪资格对FoxInspection抑制优先，不消耗新编造库存。

## 实际接入及人工预期

8场景×SDK/ACP/混合×中英＝48本机完整局，每局严格Tape、每决策/checkpoint/事件/结果核对、MCP进程/会话回收。场景：普通刀狐、原生验狐、毒+验狐、梦保护验狐、魔镜验狐、Lucky验狐、狐本人收取奇迹查验并验狼、末狼王放逐枪狐。oracle为手写夜死名单、终局存活/获胜ID及判胜点；脚本actor不获得其它角色或生产判定函数。末狼王先枪狐再Good胜，没有提前Fox胜。

额外21单元/流程判例覆盖同life身份替换、目标新life、actor撤权、取消/非法、投影回调、纯查验伤害无marks、guard+heal不挡验狐、复合毒、caster首次死/复活、夜间重入、首日竞选后逐死因滤除、最后Good死独胜。10板×50固定seed×2语言＝1000局，含官方10/12人配置；每局有界结束、单一终局、显式成员、个人胜利时狐活且普通阵营全灭、库存不负/不超限。

三份实际God replay作为前端fixtures，6中英单元检查studio/纯video frame相同胜利事实与翻译目标；6新Chromium场景检查存活/死Fox与获胜成员、终局字幕和座位布局。截图 `/tmp/awa-p8-fox-{zh-CN,en}-browser.png` 已实际查看，英文独胜文案、角色与座位正常。本批没有声称MP4导出已完成。

## 新源码门禁

运行基线head c8ddb120080795238810a5d37b490a1381efb05a + 本批未提交功能差异，sourceHash `1991fee418e410c0e80cf91521ff99a0837be9e53cc022e38b2b42c799398b3c`，lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`，均由实际reproduction记录；此后未改功能源码。后端四组精确212文件并集，2441通过/0失败/203174断言；671/521/656/593，各退出0，最长398.38秒。清单 `/tmp/awa-p8-fox-backend-manifest.json`，日志与状态 `/tmp/awa-p8-fox-backend-{1..4}.{log,status.json}`。定向51/5120通过。此后仅扩充测试：狐本人收技三transport双语额外3/699通过，1000局10/9426通过；功能源码指纹不变。当前测试清单新增4项，不把既有2441全量运行改称2445。

前端229/2167/33文件通过，日志 `/tmp/awa-p8-fox-frontend-tests.log`。完整Chromium88/88、0跳过/失败/flaky、单worker零重试，JSON `/tmp/awa-p8-fox-browser.json`，stderr另存。首轮新浏览器用例2失败为断言把胜利文案定位到判胜时间组件；修正到既有result-chip后全部88通过，没有放宽语义/超时。新视频帧夹具API错用也已修正，前端全量重跑通过。

根check/lint及前后端build通过；已有>500KB bundle提示保留。源/测试/工具严格检查未放宽。root format:check与git diff --check通过，日志 `/tmp/awa-p8-fox-format.log`。没有push、部署、真实模型调用、秘密读取或系统设置变更；断线后只读确认四组命令已自然完成，没有重复提交操作。跨线程进度发送被自动审批拒绝（缺目的地发送授权），没有重试/绕过；本轮 commentary 已报告同样进度，源码工作不受影响。
