# P9d 寻香识命原生十二人完整技术验收

本批登记寻香魅影与从 P9f 前置的觉醒预言家为 implemented，限定[规则卡](../../rules/awa-fragrant-pair-seer-twelve-v1.md)的原生十二人组合。目录达到23 verified、29 implemented、12 planned，52/64；P9d及两个觉醒前置已齐。继续 P9e六项、P9f余六项与P10，保持main本地功能提交。

## 完整交付与独立审查

[运行、独立录制及交付记录](p9-fragrant-pair-runtime-recording-delivery.md)保存原发现、修正、实际通路与前端范围。此前[纯状态](p9-fragrant-pair-state-foundation.md)、[唯一owner](p9-fragrant-pair-authority-foundation.md)、[共享协议](p9-fragrant-pair-shared-contract.md)分别按功能提交。

- 原生 native:pair_check 资源及双目标布尔查验、真实夜初固定随机知识、魅影独立狼权限、绑定／到期／一次牵连、接刀及原生命撤权；七类共享严格事实与双语受众。
- 每实际死亡波唯一提交，完整遗言／警徽／枪与追加波后判胜。required-op失败保 canonical已付款库存／真实生命；已公开放逐、枪、自爆凭原feed和准确周期授权知情，God事实与待公布夜死不授权。
- 独立账本从原seed、动作、native库存、真实请求机会／游标和原生命推导状态与知识；原决定／事件／CP共同删除、未支持混搭、假op／来源／公告均拒绝。每完整或失败记录均有严格Tape。
- 十二人工族×SDK／ACP／mixed×两语＝72完整通路局；四个必答阶段missing／late合计32失败局，两个新工具schema／域拒绝后同turn更正8完整局。真实保留MCP提交验证1秒截止、2200ms后到达、旧ID／关闭拒绝及sidecar退出；取消回收证据独立保存。
- 20固定seed×两语40受限观察完整局，逐局自然终局、零拒绝／fallback及Tape。调试重复批次不增加唯一seed数，P10约1000seed／支持板继续。
- 10实际God录像、10末CP及40实际玩家档；18本批Chromium为10God工作台和8最小授权玩家movie。独立中间帧／逆seek、DOM caption／11席遮蔽与两张1280×720 Remotion PNG均已审查。工作台仍为God，最小movie不等于直接玩家JSON加载UI。

R、A、T/L/D分别复核来源／有限范围、原生命／资源／独立账本、实际schema／初始化／当前／历史／错误及真实界面。原roster、fallback、重复波、失败CP、知情前缀、死女巫库存、遗言机会和独立wire／DOM意见均由原提出者复验关闭。

## 第七轮冻结输入与全支持门禁

源码HEAD `212081f417f9925e4e9d6a73a4fd63fbe7973fa4` 加本批候选，全部公开源码、测试、60新档、配置与文档冻结2310文件。before／after／after-on-exit及独立当前采集四方字节一致：

`168a011acaa85cbda14f0f6606aed6e70ee5c7cd450202bb9271bd3c761ce51e`

目录 `/tmp/awa-p9d-fragrant-candidate-full-seventh`，驱动 `/tmp/run-awa-p9d-fragrant-candidate-full-seventh.py`。Bun1.4.2、系统Chromium153.0.8010.52；driver SHA `486bdaa3eef635bbe12eaf17483fee6cc25c1a27bde1c807018d81787c9dfbc6`、collector SHA `6d8861ed3400883f675d1f7052a5f0b79b459d198beb8f5bcce7c263cc6ec88d`、调度耗时输入SHA `7a46c99a4eef44180d5243b09e9a4762096367d6ff78e924c9e023024cf20907`。耗时表仅用于分片均衡，其中重复footer造成1.06ms估计误差，不改变测试范围。

| 门禁                                 | 实际结果                                                |
| ------------------------------------ | ------------------------------------------------------- |
| 类型／lint／格式／diff               | 全部退出0                                               |
| 六后端分片80／80／80／81／80／81文件 | 1006／1037／1242／1162／1069／1018通过，零失败          |
| 九敏感文件串行                       | 55通过，零失败                                          |
| 后端合计                             | 6589通过、0失败、1条件导出skip；491唯一文件、893707断言 |
| 前端全量unit                         | 936通过、0失败；77文件、57467断言                       |
| mock smoke／双端build                | 全部退出0                                               |
| Chromium                             | 342通过、0失败；22spec，1worker／retries=0，365.55秒    |

16门禁各执行一次，无失败后补跑混算。唯一skip为显式导出开关的历史测试，不算执行通过；本批60实际档另有导出／逐字节证据。A最终独立审计 `/tmp/awa-fragrant-seventh-final-independent-audit.json` 核rawheaders与footer、文件恰一次、Chrome原序号1–342、全部22spec、manifest及工具链SHA，无本批技术阻断。

六分片命令传CLI `--timeout 30000`；真实setup的单文件探针表明jest.setTimeout(10000)会重设为10秒，不能宣称所有跨文件hook实际获得30秒。九敏感文件命令、普通行动10秒／精确故障1秒／真迟到2200ms及显式模拟180秒均未修改。本轮不宣告P10性能预算完成。

## 原失败轮与登记边界

第一、二轮在类型处退出；两处readonly tuple期望复制为同值可变数组，断言不弱化。第三轮6532通过／2旧机械配置错误码期望失败／1skip，482文件；精确补新角色preset错误码，生产不变。第四轮后端6589零失败／1skip，前端933／3旧AST父接口覆盖失败；加入明确新共享契约映射仍拒未知父接口，原文件及全前端通过。各轮原日志和冻结指纹保留。

第五轮静态四项通过，驱动分片权重长度IndexError发生在测试启动前，已统一参数与长度断言。第六轮十二并发引发尾延迟，原始5987通过／6超时失败／1skip、440已打开文件，未全量完成；仅任务所属97子进程控制结束，12部分分片退出-15，驱动留存输入闭环，复查无运行子进程。两处hook、Mist两语180秒、Ghost两语180秒及3条附带ENOENT由A独立分类，未列作本轮结果。恢复六分片后第七轮完整通过。

本验收、进度／角色／规则卡登记及CLI预算表述纠正为门禁后文档字节，不冒称属于上述冻结指纹；另查链接、目录数量与格式／差异。临时Animal纯状态／配置草稿、下一批来源研究不在本轮范围或完成数量内。

本批未读取用户configs／认证，未调用计费模型或推送。P9e／P9f余六项、P10配置编辑器／22机制矩阵／长局资源／公开ACP文件与环境隔离继续；T6按明确隔离配置及预算或具体授权阻碍处理，用户总体验收仍开放。
