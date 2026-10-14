# 死亡枪资格捕获的完整 owner

## 职责与原顺序

本批 C28 基线为真实提交 `96d3d0272392f8ad625ece176cee36df6dd789ea`；捕获时死亡结算器与此前 `40dd1e4d` 的完整字节也相同。范围为 7 源：结算器、已有死亡能力公开入口、新资格 owner、猎魔人端口、猎人／狼王两个状态叶及一个新单元测试。

`captureDeathShotEligibility` 完整拥有赠枪查询、原生状态／政策／死因身份捕获，以及 `nativeCurrent`、`gunCurrent`、`permissionCurrent`、`eligible` 的原组合。结算器在原点实际消费公开入口；恐惧、阶段／日期／终局当前性、目标生命、请求、await、重试、许可开关均留原处。`resolveDeathShots` 的资源消费和付款算法未迁移。

缺失指定赠枪仍先返回原 invalid，不能继续读取角色、原生库存或死因。原生政策和 `JSON.stringify(sources[actorId] ?? [])` 仍在原捕获时点读取；后续比较相同角色、库存引用、政策、死因及完整允许来源，不缓存最新授权结果。

资格保持 **Demon → 枪当前性 → 原生当前性 → canShoot** 短路。原生 Hunter 身份独立于是否选择赠枪：Hunter 持赠枪时原生状态未捕获，但仍执行猎魔人原体检查。`permissionCurrent` 不包含最后的 canShoot，`eligible` 才包含；两函数不能互换。

只读运行对象通过 getter 在原 callee／参数位置读取 World、日次和原查询。Demon 查询从其公开端口获得原 live binding，只有原 Hunter 分支才取得并裸调用，保持 callee 先于 World／actor 参数及原 receiver。其余角色和赠枪 owner 使用原具体函数，不新建库存、lease、缓存或通用框架。

返回的政策／closure 是同进程运行关联，不是玩家知识、JSON、权限品牌或已付款事实；捕获资格不打开死亡行动。readonly 不冻结 World、资源或回调。

## 公开归属与中文维护

已有 `death_abilities.ts` 具名公开完整捕获 owner，并由结算器实际消费；原 `validateGiftGun` 和其它公开绑定保持。猎魔人端口只新增原 `demonHunterNativeGunCurrent` 同绑定。

猎人／狼王状态叶只将责任头改为中文，明确原 raw 槽读取可能执行调用方 getter，TypeScript 断言不进行 schema／Proxy 校验；set 先赋原值再返回同引用。生命周期、付款、投影和资格仍由原 owner 处理，不将直接读取称为严格解析。

## 完整证据

[紧凑汇总](generated/death-shot-eligibility-evidence.json) 引用独立持久附件，未复制整图／所有源／整证明。 [最终 SHA](generated/death-shot-eligibility-scope-final.json)、[真实 before](generated/death-shot-eligibility-before.json) 和 [完整程序证明](generated/death-shot-eligibility-proof.json) 可复核。

- 5 个既有待改源与 7 个控制在捕获时均与实际 Git 相同；原生命周期、Demon 权威、两角色端口、来源政策、付款结算和精准测试 7 控制保持完整字节。
- 新 owner 的原完整算法用同一比较包装核对 303 个 AST 节点及全部非注释叶；仅反演同 closure 返回、缺失赠枪 sentinel 和已精确核对的 Demon 晚 callee 适配。
- 当前真实 owner 展开回原调用点后，完整结算器 4,831 节点及两份 ESNext／CommonJS 原始打印结果相同；恢复 imports 前逐个核对全部保留绑定及物理端点，未用旧主体代替新 owner。
- 12 个原命名／类型绑定保原物理 owner；新明确返回类型 `DeathActionPolicy` 使用已有公共唯一类型，不新增运行值。
- 已有公开入口、Demon 端口和两中文状态叶分别完整核对，两个状态叶共 4 份运行打印保持。
- 当前 [75 模块有界值依赖摘要](generated/death-shot-eligibility-module-graph.json) 无返回 new owner、结算器或公开入口的路径，无 AI。Demon 仅 type-import，避免将 Catalog 返回链挂到新 owner。此图不是全仓门禁或计算型导入／二进制冷初始化保证。

## 一次有限验证

[实际收据](generated/death-shot-eligibility-receipts.json)：

| 验证 | 结果 |
| --- | --- |
| 新增：缺失赠枪、原生短路／政策与死因复验、Hunter 真实赠枪 | 3 通过／0 失败／28 断言 |
| 原“合法好人赠枪保留夜间资格”精准 case | 1 通过／0 失败／8 断言；23 项过滤 |
| 7 roots 有限类型 | session `2215`，实际终止 `401f0b`，退出 0 |
| 7 源职责头及中文头 | 零诊断；当时已跟踪且存在的 455 个文档路径 |

本批共 4 个独立 case、36 个断言。原 case 名称、输入和断言字节不改；没有重复旧套、全量类型、门禁、整局、模型或网络。新测试直接使用真实库存／生命与赠枪，并以手写读序核对 trusted 查询接线，不将生产结果生成预期。

## 明确变化与后续

新公开捕获 API、返回关联结构、缺失赠枪 null sentinel 和额外查询对象改变内部／公共调用形状；实际结算器仍把 null 转回原 invalid。模块加载、函数栈与未知反射／CJS namespace monkey patch 兼容不作为等价保证。

新路径、注释与模块接线改变新来源指纹；历史旧指纹保持，不新增跨构建复现豁免。这是具体资格边界，不声称完整死亡链、所有角色资源或全 C28／P9 完成。

独立源审后按功能提交，避免混入并行夜间可读性、台账或其它机制切片。
