# P9a 鬼魂新娘请求与录制提交边界

接515c882的[授权基础](p9-ghost-bride-foundation.md)，本笔仅闭合请求预算撤权与录制结算的交接。角色仍planned，未把primitive注册成完整角色，未声称实际Ghost整局、双语transport、Ghost Tape或前端展示通过。

## 实际修改

core以WeakMap给原请求绑定交付检查，scope另持一次pending结算回调，均不进入模型context或Tape。合法deadline克隆经原字段引用、原scope与不延长预算验证后，绑定自身guard，共享原scope结算；普通复制仍不授权。第二份Witness的query与交付检查同步复验第一票原proof、持续授权及预算。

ReproductionTrace在provider返回后先安全复制动作：拒Proxy、getter、非plain和不完整数组，不执行provider序列化副作用；返回同一脱离provider的安全副本。原provider抛错保留原错误名，敏感错误消息仍不落盘。无交付绑定的原有正常请求保持即时结算。

Ghost有scope的请求在provider成功返回后保持pending，直到同步域提交才记action，拒绝/回合或全局finally关窗记error。提交前原授权复验保留，不能用较早的guard替代。首票可在provider返回后到第二票域提交前过期，此时第二份decision成为error，保持真实一票/no-group前缀；Tape无需伪造墙钟。有效但不同号第二票确实已入votes，必须先记action再关闭失败setup，保持真实分歧两票。chat先提交pending receipt，只有takeWeddingChat的最终生命/授权复验和一次投递完成后才记action；拒绝投递当回合立即记error，不依赖全局关闭，也不推进chat或允许绕过。

这仍不是独立工具授权：原scope、preflight/gateway与域commit继续各自验证。后续Ghost controller必须在finally调用原关闭函数；新的setup/事件/CP/parser矩阵与真实失败Tape仍待完整接线。

## 实审与证据边界

三组原审查者发现并复验关闭：成功落盘到域提交间隙、deadline clone缺guard、guard后的getter副作用、chat拒绝却等待全局关窗。delivery审查独立跑6子集/43断言及最后chat反例1/7，另外用实际Trace+Ghost scope联合内存探针确认第二票返回后pending，随后首票过期则error/一票/no-group；不是实际Ghost game runner Tape。

本笔新录制7项及Ghost authority75项，加实际普通六人game runner失败Tape1项，合计83项。六人探针使用configs.example与假provider，不调用真实模型：await中撤权导致runner拒绝并落finalized partial Tape，RecordedActions与真实引擎逐decision/事件/CP重放同一失败。该普通板局证据不能替代未来Ghost超时、分歧和chat失败Tape。

冻结当前源码后，全部engine/recording及原runtime reproduction replay和新增failure replay共 **1730通过、0失败、17677断言、87文件**。root check（含tests类型）、lint、format:check、backend build均明确退出0，git diff --check通过。未改前端/公开角色/事件/UI，前端最新完整角色门禁仍312单测/152浏览器；未为本笔纯后端基础重复全浏览器。最新完整后端发布证据仍是孤独少女3164项，本笔子集不冒充全量发布结果。

sourceHash `eb217066af587803fd382fb4107c8c1a28a9c8b28721cacb169b443ef78fb5a5`；lockHash `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。日志为`/tmp/awa-p9-ghost-bride-delivery-final-{affected,check,lint,format,build}.log`，fingerprint为同前缀proof.json。最初guard方案的通过子集未闭合成功到域提交窗口，已替换，不能作为最终证据；新增测试曾有TypeScript callback控制流收窄错误，明确修正测试类型后重跑check退出0，没有放宽实际断言或生产授权。

本地main原子提交；不push/部署/真实模型/用户configs或秘密操作。继续Ghost完整runtime→strict Tape→双语运输→Observed/World→呈现→三路实审→完整门禁，及P9/P10；目录仍23verified/7implemented/34planned，总体待用户最终验收。
