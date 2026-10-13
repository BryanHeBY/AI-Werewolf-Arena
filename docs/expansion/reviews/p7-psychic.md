# P7 通灵师交叉审查

范围：[冻结卡](../../rules/awa-psychic-v1.md)、[契约](../psychic.md)，共用role_check的policy、女巫后时序、repeat/skip、原生命与私有受众、真实接入/重放、中英前端。纯文件归属先独立提交46a4bed，行为与角色启用本笔。

## 发现与处理

| 审查   | 问题/要求                                                 | 处理                                                                                                     |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| R/T    | 来源未明确self/repeat/alive/skip，机械版本差异不能混      | 卡逐项注明AWA选择，600相对女巫/未来学习与技能；普通通灵不套魔镜禁重，经典版.net与网易.com分开            |
| A      | 同名工具按实际角色/注册顺序会污染gift两policy             | shared neutral spec/validator按bound实例，two handlers只处理自己policy；baseline/hints/prompt/bot同步    |
| A、R   | skip是否关本夜必须唯一明确                                | 卡选择lastUsedDay关闭/uses不增，合法null决策与非法null目标分开；成功/skip/noTargets ledger隔离不授Garg刀 |
| A、R/T | gateway后撤权、copy隔离、完整pipeline重入与梦/Charm需固定 | 纳入仓库回归，取消null不当skip；typed报告前缀保留、死亡/最后judge仍既有owner                             |
| L/D    | 原生背景与获赠规则有阅读歧义                              | 中英state明确原生能力与本轮bound规则，不改action/schema/身份；独立实际交叉gift验证                       |
| 主代理 | 新optional policy重构时显式undefined与缺键应保JSON语义    | transfer返回state先JSON规范化再深等，legacy正回归；policy改变/历史清空仍拒绝                             |

三路只读。A独立core46/340及8项/tmp probe，确认pipeline成功/pass同日拒重入、World隔离、gateway撤权及复制policy独立，源无阻断。R独立48/354，人工复算六场景死亡/遗言/存活/判胜，最终补核心覆盖后独立58/413复查0阻断。L/D独立6/238两语观察/目标/DTO/权限、40/628核心配置终端、actual factory4/54和front fixture6/44，当前无生产阻断。

## 已运行证据

- 角色core24（连旧Garg+config58/413），`/tmp/awa-p7-psychic-core-final.log`；复制、完成后再撤权、fullpipeline重入、梦/Charm和旧optional字段转移正回归均人工断言。
- 初轮新通灵36＋Garg36完整双语局/Tape **36 tests/12004**，`/tmp/awa-p7-psychic-wire1.log`。通灵40seed+config **4/407**，`/tmp/awa-p7-psychic-sim1.log`；全engine/目录/双语/终端 **520/10507**，较早source证据`/tmp/awa-p7-psychic-regression1.log`。
- 加强十二人药枪/警徽与王枪/熊时序、双policy赠予真实factory，共 **6/1249**，`/tmp/awa-p7-psychic-gift1.log`；gift是四项专项，不混入完整局计数。
- frontend **109/998**、type/build过，`/tmp/awa-p7-psychic-front-{tests,type,build}.log`。首次浏览器 **45过/1失败**，既有no-winner用例停留加载态超时，新四case均过，`/tmp/awa-p7-psychic-e2e.log`；定向原预算仍失败，入口健康检查调整后1项通过，最终46全过；见[独立测试启动笔](p7-browser-readiness.md)，未确定原API/HMR/冷transform根因。

## 最终功能门槛

最终verified目录 **17/47**；type/deps/boundaries/i18n57精确例外均exit0，受影响engine/配置/目录/两语终端 **527/10558/42文件、0失败**，`/tmp/awa-p7-psychic-regression-final.log`。最终source的基础50＋Garg36＋通灵36＝**122本机双语完整局/全部严格Tape**＋两角色80seed/全部重放＋8gift实际专项 **73/36177、0失败、exit0**，`/tmp/awa-p7-psychic-wire-final.log`。源码未在活跃对局中修改。

frontend109/998、type/build通过；最终 **46实际Chromium、exit0**，`/tmp/awa-p7-psychic-e2e-final.log`，保原5秒断言/120秒启动预算。两实际God档PNG `/tmp/awa-p7-psychic-zh.png`（frame2440、D2合法skip/仅1已死）与`/tmp/awa-p7-psychic-en.png`（frame6760、D3重复role:Werewolf、5持徽、2/3/4/7/9已死）render exit0，主代理/L独立目检标签、席位、字幕不重叠，无提前winner。本笔不另称重新编码MP4。

三路R/T、A、L/D正式只读复查0剩余实现阻断，最终gateway/copy/reentry/梦/Charm/legacy JSON规范化与原生背景均关闭。角色功能门槛按delivery§3；P7未结束，不将本笔当P6的542历史局加本角色36＝578局完整矩阵的当前source全量复验，整阶段需再运行全支持release。未调用外部模型、访问认证或修改用户configs；P7剩6项及P8–P10/47角色/长局/T6持续推进。
