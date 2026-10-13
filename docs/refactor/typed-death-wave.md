# C27–28：真实死亡波计划与提交回执

固定原输入 Git `496414bf`；5 个源码／测试路径与 SHA 见 [固定证据](generated/typed-death-wave-evidence.json)。4 个源／1 个新增精准 unit，此范围不含归档与已单独提交的伤害证据、枪／普通能力所有者。

## 实际执行链

- 原 `resolve` 初始关系闭包后打开一次 initial unit（captured resolutionDay/actionPhase）；每个真正的 hook proposal 打开一次 additional unit。单 proposal 的逐目标 mark 共享身份；next 再访通过原成功凭证列表保留各原波身份，合并不伪造新 WaveId。
- `DeathWavePlan` 使用原 pending/allSources/originPhases 引用；seen、枪列表、死亡原因只有原所有者一份。仅增加诊断凭证列表，无新的 World 或库存 store。
- 两个真实 mark 站点提交 plan。原 `ledger.set` 参数位置复用 `{component: alive, version: aliveLifeVersion(alive)}`；set 方法查找仍早于原 version 参数读取。条目在成功 set 后冻结并进入 receipt。各原 Alive/state/events/getter、paid、role fact、枪列表和继承时点保持。
- 真正 route carrier 接在 PM special/Demon/Noble、Mist、ordinary 三分支。early/ordinary 捕获原第一次 `night.damage` 求值而不新增该 getter读取；原 deathLives.get 表达式同时保留 map 引用，不另捕获 World 原体。
- entry 只在 still-Poison 且原 origin 锁定 body/version 匹配原 mark Alive/settled version时记录 accepted routes（direct 用 targetBody/targetVersion，reflected 用 sourceBody/sourceVersion；死亡版本允许原 captured 或 captured+1）。不读取 route.target 可变scope当权威，不查询额外 World/alive/资格。未知/unversioned/替换/旧结果无来源时只 unknown，绝不以诊断结果拒绝旧死亡或制造原因。
- 初始 callback 在原 pending/sources 两参数后接第三 receipt；实际 PM callback与 resolver公开原事件处关联 receipt。逐枪在原 shot.event push后关联；追加公开事件同样由每个成功原体的receipt关联。GameEvent不添加Symbol、不反射、不冻结、不换payload。冻结事件/Proxy可原样关联。

## 明确行为／新增接口差异

1. 新增 data-only 全输入静态预检：原 structuredClone(sources) 后、Animal准备／关系事实前验证 roots/causes/deathPhases；extra proposal 原 spread/clone之后、claim/facts前验证 roots/causes/nightTargets。NaN、不合法静态cause/phase、稀疏/非名单静态shape拒绝 `death_wave_input_invalid:*`。先前已完成波不回滚。
2. 预检不执行 Proxy/accessor/custom iterator/继承对象的读取；opaque输入继续原惰性读取。原源 structuredClone 的 getter/抛错仍在原位置，不是宣称所有恶意动态输入都归一化或严格DTO。
3. 新 plan/ids/source身份不一致仅新plan调用拒绝 `death_wave_commit_input_mismatch`；原未传 plan API默认实参和输入接受集不变。
4. 新成功 receipt 返回值替代旧 void；原 callers不读返回不改变语义。继承/枪/记录抛错无成功返回，合法原 mutation/账本前缀保持。
5. 原账本内条目此前未公开；新对外证据复用其对象并冻结该新公开记录，Alive不冻结。查询类型只读，不授予命令能力。
6. `wave.units`是实际提案身份，不声称已完成 C31的NightId/ExileUnitId/全部effect来源归档。原事件和schema2枚举形状不变；其它effectfamilies来源仍后续工作。

## 完整源码与原输入证明

- `originals.json` 3原文件文本/SHA逐条对actualGit496相等。
- `program-proof-final.json` 三整个非import程序按明确新增宏逆变换：ESNext/CJS六项都同；所有原imports的module/typeOnly/name/alias同。`prove.ts`可审核每个宏，原未列举的代码未跳过。
- `program-proof-first.json` 保留初红。第一脚本错误把原literal0节点用新SourceFile pos打印，及rawimport比较把prettier逗号当绑定变化；修的是harness，见 `first-inverse-red-explanation.md`，生产源码未因这些红改变。
- `headers.json` 5个真实中文责任头0violations；重要账本、来源、失败与发布注释为中文。

## 必要收据（均实际终态）

- 新7 + 原 DeathCommitter3：10 pass / 0 fail / 68 assertions，`tests-first.log`。
- 最后 route/original-body两关键新case：2 pass / 0 fail /18 assertions，`tests-route-final.log`，限定修改后的metadata实际行为，未重7。
- 原 pending stale Shot独立source两个分支 + accepted stale shot paid前缀：3 pass /0 fail /11 assertions，`existing-paid-prefix.log`。
- 首finite输入配置缺/tmp可达Node/Bun类型库红：`types-first.log`；第二71834 exit2只有两个新增test typing（hook空分支union以及ComponentName），原输入不改。
- 最终同一finite7root project session87022 **actual closed exit0**，`types-final.log`；包含4源+新unit+上述两个原测试，不重完整suite/Rootcarrier/gun/check项目。

后续严格sourceHash/归档版本由现有机制自动覆盖，不重生成 golden。Root 及两个独立方向按最终摘要审查；验证范围与各次增量收据分别保留。

## 最后真实链必要增量

Root要求新增一个真正 originalPoisonIntent→实际PoisonMark→DamageResolutionSystem.resolve→damagePoisonRoutes→真实resolver plan/mark→entry/publication 的手写case。只有原newunit改动，四源与初freezeSHA同（`first-freeze-scope.json`保留）。该case独立验证cause Symbol、source/target原body、captured version0→settled1，以及事件无枚举扩展；不使用真实模型或伪paid许可。只跑该新增case，receipt见`test-real-chain.log`，原10/2/3收据仍分开保持。

## 终审兼容 finding 修复

原 first-freeze 与 pre-metadata-fix-scope/program-proof 全保留。resolver 新 metadata 字段现只读非 Proxy 对象的 own data descriptor，旧同名getter/Proxy不反射也不 get。原metadata map查询使用缓存 native Map.prototype.get 对真实内部Map条目读，不查找或调用覆盖的.get；MapProxy记unknown。实际两个新增literal反例覆盖empty/nonempty × getter/Proxy，及 Map.get accessor/Proxy，无额外World/clock/库存读取。只跑这两个必要case：2pass/0/27 assertions（tests-metadata-fix.log）。finite58007 actualclosedexit0（types-metadata-fix.log）；其后仅 ownMetadataValue 对null/primitive也跳过的同类型predicate完善，未改已有计时/输入/调用语义，不将原compile冒称包含后续字节。六原程序 inverse 再核仍0，heads见同现finalscope。

最后 sameoptions 的 single-leaf finite项目（tsconfig-metadata-leaf-final.json）覆盖null/primitive谓词最终字节，session11470 actualclosedexit0；types-metadata-leaf-final.log。没有再运行真实producer/此前10/2/3用例。

最后Root提出的唯一trivia修正：将“来源集合可继续…”注释放到实际DeathWavePlan前，Unit仅保开波身份说明；仅1SHA更新，未改任何AST程序/类型结构，不重编译/测试。

## 中文维护说明及后续范围

职责头、原体身份、实际单位共享、账本与回执时点、静态／opaque 边界、单目标失败及发布关联均就地使用中文。审查修正了一个说明位置：来源集合说明归 DeathWavePlan，单位说明归 DeathWaveUnit；最后只改该注释，不重行为／类型检查。

此批连接真实毒来源、原生命提交和原发布边界；其它效果族的完整因果、其它业务时钟、关系扩展、记录模块回执贡献及 P9 同源全量验收继续。静态拒绝、plan 身份守卫和新增返回值／第三 callback 参数是明列变化，不声称所有旧调用的可观察参数完全相同。
