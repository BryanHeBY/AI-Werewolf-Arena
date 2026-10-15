# 配置、默认值与有限支持

## 公开文件结构

正常配置只从显式configs-dir中的下列文件读取：`runtime/providers.json`、`runtime/agents.json`、`games/<name>.json`、`boards/<id>.json`，可选`runtime/debug_summary.json`。板子为完整version2声明；正常运行不搜索旧根路径、回退内置板子或覆盖本地秘密配置。

provider声明连接和并发／初始化预算；Agent声明`kind: llm|acp`及模型或命令；game引用板子和Agent；board保存完整角色／机制参数。debug_summary通过agentName引用既有Agent，不能内联绕过配置解析。

## 解析、默认与组合是不同责任

纯shape／稳定枚举由共享契约拥有；生产有限支持、角色count、组合及政策分派由rulesets拥有；归档验证保独立的有限谓词。一个角色在Catalog有资料不表示任意板子支持它。多个角色共用一机制亦不等于可自由排列。

省略与空对象的默认值、未知字段／版本的拒绝、反向serialize次序都应由真实schema和贡献闭环。不能在提示里声明支持、运行时却忽略参数。normalizer按原贡献顺序调用；caller转换／getter可抛，前面的写入不统一回滚。

## 选择与限制

玩家Agent选择优先级是席位→角色→对局默认。personalityPrompt缺席继承Agent；显式null清除；原字符串／双语字典按既有locale回退规则解析。原始人格与名字不是应翻译的维护注释，也不应输出到脱敏报告。

超时、并发、天数等按实际schema接纳有限正值；不要根据某篇早期文档的角色数量推导现行支持。当前55已交付Role与9 planned资料分开，有限支持及未开放变体从[规则卡](../rules/README.md)进入。

## 常用有限政策

- Seer显式actionPolicy区分必选与可选；省略／空对象保持同一当前默认。
- Hunter／WolfKing原生deathActionPolicy与复制／赠予枪来源分开；不能从持有者角色配置改写受赠枪政策。
- Gargoyle／Psychic／Mirror的查验政策与身份／伪装／接刀时序分开。
- 警长、放逐PK、死亡持徽选择、公开死亡和遗言采用具名有限政策，详见[对应契约](voting-and-public-death.md)。

完整版本／来源／未支持范围在各规则卡和实际公开board示例。板子JSON文件名同时是加载ID，不能随feature目录改名。`time-wolf-consort`组织slug不改变`awa_time_consort_12_v1`文件／board身份。

## 迁移与安全报告

旧配置只经显式config:migrate预览／--apply迁移；先校验转换、保备份、独占发布。批量失败按原owner尽力补偿并保原错／回滚错，不承诺多文件事务。不能整目录复制examples覆盖密钥／人格。

config:check只给安全字段／来源与执行支持，不打印provider对象、认证、URL、命令参数或人格原文；未知输入拒绝也不回显JSON片段。运行方法见[本地指南](../guides/run-locally.md)。
