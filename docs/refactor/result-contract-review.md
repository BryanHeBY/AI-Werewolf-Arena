# C07-A 独立只读审查

范围：五个新纯契约 outcome/inspection/error/death/result 文件、result-contract 测试、三个 catalog compatibility facade，以及 core results/deaths；共 11 个作者文件。Root index 仅额外核对公开消费。原始证据直接取 Git `2d36e4d0d17283e49e922ada1bbad8635a0b7382`，没有采信作者 proof 作为唯一 oracle。

## 结论

本范围未发现阻塞问题。数据声明及 domain 运行选择/许可算法保持原行为。没有将新 DTO 当成运行凭据，没有把死亡来源、NightLifeScope 或 callbacks 搬入共享协议。

## 原字节与类型边界

独立 proof `/tmp/awa-refactor-c07a-independent-byte-review.json`：

- outcomes 声明起始 `FACTION_IDS` 至末尾：1,187 bytes 精确相同，SHA `66b0c40c...`。
- inspection 三分支与 InspectionKind：288 bytes 精确相同，SHA `78494d98...`；唯一引用变化是 type RoleId 从 catalog index 转其 contract owner。
- RuleError enum + Object.freeze + RuleViolation：5,502 bytes 精确相同，SHA `5cd78841...`。
- GameResult/WinDecision/Seer/Night/Day/Voting/RuntimeSnapshot 声明：969 bytes 精确相同，SHA `2f8d99d9...`；仅 import owner 改变，Camp/Phase 仍是原 enum typed 而非放宽成 raw strings。
- DeathCause + DeathSources 声明与原片段相同；提取接缝末尾空白单独标准化，SHA `9057af02...`，没有将其谎称整个原文件字节不变。
- `DeathShotSelection` 到 `permitsHunterShot` 的 domain runtime/type body：1,221 bytes 精确相同，SHA `2ff69eb5...`。保留 targetScope?:NightLifeScope、mappedMiss?:true、mappingCurrent?:()=>boolean，三种 policy/phase/default/source 顺序与 Hunter 同函数 alias 未改变。

Null/optional 范围保持：GameResult winner nullable，但 reason/outcome/decidedAt 必填；WinDecision omit decidedAt；RuntimeSnapshot result nullable；Night wolfTarget、Day selfDestructBy nullable；Voting effectiveTarget 可缺失也可 null；RuleViolation message 是可选原文。没有新增 runtime coercion/freeze/default/validation。

## 独立 runtime identity

只导入 pure contract、catalog leaf facade 与 core death facade，不执行政策算法或模型。`/tmp/awa-refactor-c07a-independent-runtime-review.json` 十项字面检查全部通过：

- RuleError 124 个原 Git member/value/order 一致，root/leaf/catalog 同对象，原 freeze 保持。
- DeathCause 30 个原 Git member/value/order 一致，root/leaf/core 同对象，仍不 freeze。
- FACTION_IDS、VICTORY_CHECKPOINTS catalog facade 与 contract 同数组对象。
- shared root 不导出 permitsDeathShot/permitsHunterShot；domain Hunter alias 与 permitsDeathShot 是同函数。

## 测试与依赖

result-contract 测试使用 literal original enum record、wire examples 和 @ts-expect-error 类型反例；没有调用生产 resolver 生成自己的 oracle。原 body 精确相同已独立核对，测试的 nominal enum/raw-faction 与可选/nullable 反例符合原契约。NightLifeScope/DeathShotSelection/eligibility 方法不属于 package public export，domain side 继续持有运行对象。

五个契约只 import 本包 identity/role-ids/inspection/outcomes；facade 只重导出 public game-contract，未建立 catalog/text/Node 反向依赖。生产 src 配置 types:[]；Bun test 环境在单独 tests tsconfig，未把运行句柄或认证带到浏览器。

## Root 整合提醒

Root `packages/game-contract/src/index.ts` 新增纯结果/死亡/错误/消息出口后，职责头仍写“identity enums, role IDs and locale/event identifiers only”，需要由 Root 随 C07 更新真实导出范围。它不是作者 A 文件，也不是以上声明/算法正确性的缺陷；尚在 WIP，不能将这个过期说明当作最终全包契约。

未运行大套件、真实模型或真实通信；只做字节比较与小型 identity proof。结论不替代 Role/board 完整验收、C07-B 数据 reader 审查或 Root 根出口/版本/指纹整合。
