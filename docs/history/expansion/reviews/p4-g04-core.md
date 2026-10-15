# P4 G04 胜利核心结果子批交叉审查

## 范围与证据

VictoryComponent/profile初始归属与身份/阵营/能力独立，三种primary/额外claim/明确获胜名单，WinDecision与实际检查点封盘，成员最终重验、一次maxDays/game_over、结果与事件副本、内部Tape v2与共享decoder源码指纹。契约见[胜利结果](../victory-outcomes.md)。公共主档/reader与终端/前端/视频呈现下一子批；合成个人/group规格不宣称对应角色已上线。

- 初步人工13/86、engine/repro245/5649过；初版完整release616/34154通过，日志 `/tmp/awa-p4-outcome-release.log`。包括50实际SDK/ACP/混合两语基础/窗口完整对局与逐局严格Tape。
- A两项发现后最终人工16/100（含empty实际checkpoint→Trace.build、坏声明安装早拒、source decoder变指纹、伪成员拒与状态/事件副本）及repro共28/228通过，日志 `/tmp/awa-p4-outcome-membership-final.log`；类型通过。
- 旧内部schema1明确拒版已有repro篡改回归；新schema2保存每玩家归属和结果/point，source/lock/rules仍严格。
- 前端54/365/type通过，日志 `/tmp/awa-p4-outcome-front-{tests,type}.log`；尚未改胜利UI，不把本回归宣称为新个人/关系胜利展示。
- 最终完整release617/34160通过（type/deps/边界/i18n/test/smoke），日志 `/tmp/awa-p4-outcome-release-complete.log`；50真实双语纯/混合基础/窗口完整局及逐局Tape全部通过。所有模型通路合成本机，无外部模型或用户认证。

## 独立三路审查

| 审查者                     | 关注/发现                                                                          | 修正/结论                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A / review_arch_tests      | Runtime reader未入source指纹；[]构造成功而Tape min1拒绝；其它类型/alias/最终成员   | 指纹含replay-contract及隔离变更实证；constructor/Tape共用strictreader明确[]，坏ID/重复/getter早拒；独立16/100，最终0阻断        |
| R+T / review_scope_rules   | 初始归属独立、含dead、实际Good god/vill统计、条件顺序与point、合成Goal边界         | 独立13/86，0阻断；未把个人/group规格当角色实现                                                                                  |
| L+D / review_i18n_delivery | 语言中立类型/null投影不等于无胜者、未发私有归属、schema2/旧1/API与public下一步边界 | 初读15/95，0运行阻断；reproduction.md/current2、Spec/Evaluator/ConditionRegistry迁移/必填终局字段/深副本已同步并复查，最终0阻断 |

初版green并未掩盖独立契约缺陷；两项实际发现均修复后验证。基本条件的历史reason/winner投影保留，已补充新字段的人工字面期望，没有把exact equal改成宽匹配以绕过结果要求。

三路最终0剩余阻断；本批只完成G04核心状态/封盘与内部录制，公开主档/呈现与P4整体验收继续。
