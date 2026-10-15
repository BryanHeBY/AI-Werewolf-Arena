# C06 唯一机器身份与兼容双桥候选

实现范围：仅 packages/game-contract/**（不包含node_modules），backend/src/core/domain/identity.ts、packages/game-catalog/src/index.ts。未改现有包/root依赖、lock、sourceHash、runner、baseline/fixture；这些由主实现同commit整合。

## 来源与兼容

- 新纯包独占9种原identity enum、EntityId、TieBreakerStrategy、Locale/LOCALES/isLocale、全部64 RoleIds、事件/物品IDs。
- Role保持原55个已交付成员、同name/value/insertion order、同enum member types；planned9只有具名数据声明，不加入Role executable枚举。
- 全64 RoleIds保留原catalog独立顺序；引用Role或planned常量唯一value来源。RoleId使用template-literal raw string union，不把JSON字面变成enum nominal成员类型。
- public ROLE_IDS保持原可变array API；guard查询私有canonical序列，不由公开数组编辑改变支持ID集合。
- backend旧identity出口具名转发同对象；PromptRenderable只是暂存兼容类型，未迁入纯包。
- catalog64 metadata的id改为统一引用，已实现ID使用template保持原每entry raw literal类型；其它metadata原文与顺序完全保留。仅ID引用反归一后整块原字节与27a97cb相同，SHA c53c7aba64edb10ff677987ff8d03eae8811eb6c944dfdb0cd4768083c29809d，证据/tmp/awa-refactor-c06-metadata-byte-proof.json。
- catalog原RoleDefinition.id:string宽度不收紧；RoleId/Locale/ID guard具名兼容导出，未改profile注册、Board支持、真实camp/affiliation或规则算法。
- 新包source项目types:[]、只src；tests项目单独Bun ambient。新源职责头、kebab路径、root exports与独立check/test成立；无Node I/O、World、text/catalog反依赖。

## 真实局部验证

链接完成后：

- `bun --no-env-file run --cwd packages/game-contract check`：source与tests两projects退出0；/tmp/awa-refactor-c06-contract-package-check-second.log。
- 同catalog check两projects退出0；/tmp/awa-refactor-c06-catalog-package-check-second.log。
- 四包public tests：18 pass/0 fail/3757 expect，四文件；/tmp/awa-refactor-c06-package-second.log。
- backend role_catalog+i18n契约：8 pass/0 fail/3738 expect，两文件；/tmp/awa-refactor-c06-application-contract-second.log。
- 所有我拥有文件Prettier check退出0。

新contract5项固定27a97cb字面oracle保留全部9enum keys/values/order、64顺序、55/9分离、mutable API、member-type/unknown-ID/locale ts-expect-error及机器事件IDs。额外/tmp/awa-c06-type-probe.ts验证metadata模板字面保持原entry字面类型，不混入运行schema或业务规则。

首轮在根安装链接完成前启动，缺game-contract workspace与新包bun-types链接：package-first有5 pass+3加载errors；application-first零执行+2加载errors；相应类型项目仅module/type-not-found及连带any错误。原日志保留；没有调整实现/语义为这些安装时序错误“修测试”，通过轮不累加首轮。contract source第一轮独立check0。

## 主实现收尾与独立审查

需要root同commit闭合实际workspace依赖/lock、sourceHash新增包/全行为输入覆盖、root任务、同对象/member/metadata强类型集成测试、架构gate与bridge账本。已批准局部证据不替代独立审查或阶段末同源大gate。旧Strict Tape不改指纹，新build自生严格Tape按实际来源回放；sourceHash变更政策由root切片记录。

旧出口尚为明确兼容桥，不宣称C44删除完成。C07/C08/C09后续只读范围在/tmp/awa-refactor-c07-c09-cut-plan.md，与C06实际实现分开。

## 主集成闭环

- backend / catalog声明真实workspace依赖，新contract check/test和root包runner成立；offline install禁network/scripts完成实际链接与lock。
- core-contract identity与FP局部16 / 0；source/backend/frontend/tooling/四包类型全部0。frontend stage coverage是实际ASTconsumer：改读公开enum出口并加dev workspace依赖，同文件3项0。
- 新SourceFingerprint同commit覆盖所有backend/src（AI/runtime/recording/audit等）与每shared src、TSX/JSON/JS、package manifests、维护tsconfig*.json家族与bunfig；旧6root/.ts窄范围成为历史baseline专用，不改写其hash。
- metadata ID引用反归一后整块原字节相同，enum/member/原枚举顺序与ROLE_IDS raw string/可变API保留。lookup私有canonical不被外部ROLE_IDS数组突变改变，Locale guard仍保留旧公共数组读取语义。
- 七组旧/新固定native差分与各自strict回放全一致，/tmp/awa-refactor-c06-differential-second；包链接未就绪及workspace-lock识别首失败轮分别保留，未伪装成功。
- 为减少重验证耗时，完整外部依赖库存bytehash只在差分batch前后核对；每个child前后仍核source/metadata所有成员与字节。发生primary failure也执行batch校验，异常都由工具明确汇总。此优化不改变游戏。

## 临时具名出口

core/domain/identity仍转发机器enum/type；PromptRenderable展示兼容type暂留C36。catalog仍转发ROLE_IDS / Locale / event IDs，真实consumer逐项迁移后C44统一删除兼容出口。不存在第二个enum定义，planned9个ID没有运行profile。最终未宣称全部core→text消除。

## 重门禁策略

按用户最新指令，不在每笔commit重跑完整Bun/Chromium/通信。必要类型与涉及consumer的局部断言保留；全量合并到P3、P6、P9等大阶段后台。最终P9仍要一次同源固定输入完整验收。

精确旧consumer清单：[baseline消费者](generated/identity-baseline-consumers.json)，路径和内容都读取27a97cb Git blob。早期/tmp消费者探针用baseline路径+candidate内容，已识别为provenance缺口，原artifact保留但不作为旧输入证据。具名桥退出台账：[bridges.json](bridges.json)，逐项C36/C44关闭，不以一般原则代替真实消费者。
