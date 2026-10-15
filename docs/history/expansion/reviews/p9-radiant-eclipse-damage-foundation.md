# P9d 猎日逐光：庇护／反噬伤害基础

基线 `b5dd310`。本切片提供效果消费原语，尚无 NightPipeline 生产者、借用 grant 或角色注册；流光伯爵／蚀日侍女仍 planned，目录 **46/64**。

## 判例边界

`radiant_backlash` 为独立 Night 死因，带中英标签。无 StatusMarks 的纯反噬也进入结算；梦保护过滤该来源，毒与反噬真正同时有效时保留两项原因、同目标只进一次死亡名单。DamageResult 不改 Alive。

庇护使用原生命／动态授权 claim，阻止本夜直接伤害，不写 GuardMark、不引入同守同救。DreamNightFrame 在连续梦／linked 的死亡及 reason 缓存之前阻挡对应梦伤；先过滤梦主的直接死亡，再展开牵连，防止虚假 dream_death。构造器快照庇护数组、claim 包装和目标 id/life/version，保留原 Alive 实体及绑定原 owner 的动态回调。

14 个手写领域判例覆盖刀／毒／组合／救药、纯反噬、毒与反噬独立有效源、连续梦、三种庇护梦关系和失效／换生命／复活。A 的 6 项原反例已纳入维护：外部数组 push／clear、目标重指向与方法 receiver，另保留动态撤权及原生命控制例。该测试层不伪装完整角色局，库存、施法者授权和正常／aborted 租约关闭由下一生产 Frame 负责。

## 交叉审查与门禁

A 首轮发现外部引用可改变捕获庇护，以及解构调用丢失 this；原 **2 pass／4 fail** 日志 `/tmp/awa-radiant-damage-a-review-red.log` 保留。目标结构快照、原方法绑定后，原输入未改 **6/7** 通过。T 原 6 项／11 断言及 R 五个字面场景／10 断言保持通过，分别涵盖有效来源、两段梦链截断、同波首次死亡与规则卡 3／13／17；未扩大为任意混搭支持。

当前维护新增 **20 项**，加此前状态／封禁及旧 Dream／NightAbility 回归 **107 pass／0 fail、814 次断言、7 文件**；日志 `/tmp/awa-radiant-eclipse-damage-compat-final.log`。类型、root lint、目标格式与 diff 门禁通过；默认空庇护声明保持旧 Frame 调用。没有重跑上一板的全支持范围／前端／浏览器门禁，后续真实角色切片和阶段收口继续执行。

下一步生产 receipt 必须绑定原施法者／角色／目标生命，允许已提交效果跨正常关闭与首次真实死亡，拒绝替换与复活，不能直接使用已经关闭的借用授权 `isCurrent`。手工 `()=>true` 基础 claim 不算这些权限的证据。随后接完整夜序、原库存晚校验、DTO／双语事实、独立 Tape、公开配置、实际 SDK／ACP／MCP、自然种子及帧／浏览器。
