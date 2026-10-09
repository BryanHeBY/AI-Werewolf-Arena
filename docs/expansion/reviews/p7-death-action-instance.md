# P7：死亡动作许可绑定能力实例

本笔只收口[赠枪步骤](../black-market-merchant.md#1-被动赠枪底座)的一个安全边界。没有安装礼物库存、注册Black、自动第二枪或挪动阶段；目录仍22 verified/42 planned。

## 唯一权限所有者

World的短期许可新增可选abilityId，缺省undefined表示原生；赠予实例必须提供合法非native opaque ID且仅shoot可用。hasDeathAction/isDeathActionOpen同时核确切ID，ActionReception与引擎ActionValidator使用当前request/context的ID；模型工具参数不新增字段。permit ID本身不能借另一库存，旧close只能关自己permit，原life/version/day/phase/current约束保持。

合法能力库存仍由对应规则校验和消费，World许可不创建/消费资源、不授予未知实例。当前生产DeathResolution仍只开启旧原生枪；赠枪实例及绑定请求随后交付。两次手动permit测试证明隔离，不称实际双枪支持。

## 验证范围

- 新11个核心测试：native/gift1/gift2完整交叉匹配，双语伪gift借native的preflight/Gateway拒绝、Actor复活/替换body、clock/close、旧ID迟到与旧close不关新许可、非法ID和遗言禁止附gift。
- 核心及旧life/reception专项 **28 pass/205 assertions**；没有资源消费、目标死亡或未回收许可。
- 新双语**实际SDK HTTP＋生产stdio MCP**伪造请求 **2/29**，三次业务拒绝相同，第四次SDK预算封闭/MCP registry已关闭按各自既有语义拒绝；结果均null、原gun库存不变、目标活、permit0且MCP PID已ESRCH。mock首轮每一步重复同一工具序列，修为首次回复一次、之后stop；未改变生产关闭策略。
- `/tmp/awa-black-permit-wire.log` **25/4183/3files**，包括旧Hunter首夜/枪链/原十二Aw场景×三通路×两语＝**18实际完整局及每局strict Tape**、14既有生产strict MCP wire与2emptyGun通路。未调用外部模型。
- 最终受影响 `/tmp/awa-black-permit-affected.log` **1050 pass/11744 assertions/72files**，全部engine、AI agents及所涉actual SDK/MCP集成；exec terminal exit0。首轮2个新增mock断言失败已修，最终全量重跑0失败。不是全backend release或P7结束。
- type/deps/boundaries/i18n（57已登记精确例外）及git diff --check通过。事件、schema、前端/视频文字未变，本笔不重跑无关browser/PNG。

## 独立审查

R/T（review_rules_psychic）独立28/205通过，确认反例与缺省兼容，明确手动permits不是双枪流程。L/D（review_rules_gargoyle）确认沿用双语death_action_unavailable、ID仅内部许可，未进入公开事件/DTO/工具参数、没有donor披露；A（review_arch_psychic）独立28/205并核权限/context/life与旧caller，首审0。最终1050门槛、2/29新wire、25/4183旧完整通路与文档范围由三路原审查者直接复读日志核对，均0残留、支持独立提交；未重测无关浏览器或读取认证。

之后继续赠枪实例与逐次提交/关闭、Black完整角色、P7全已支持验收，再P8–P10/64角色22机制/长局/T6。用户configs/认证未读写。
