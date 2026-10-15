# 架构与职责门禁

C04 / C05 使用同一个公共源码 AST 输入和固定债务身份，协同提交一个验证边界：依赖、公开出口、所有权、职责头与生产命名。根 check / lint 都先运行 lint:architecture；tooling 测试仍在根 test 发现范围。最终 P9 必须 --strict，无保留债务。

## 约束

- import / type import / import= / export / require / dynamic import 均解析实际公开输入；TypeScript虚拟文件系统解析extends、paths、baseUrl和moduleSuffixes。
- feature私有入口、适配器及domain反向引用、verifier调用生产算法、生产引用测试、workspace应用包、跨包src / 越界exports与包声明循环均拒绝新增。
- 债务从27a97cb的真实blob重新推导，每条绑定source、target、specifier、import kind、type/value、imported symbols；给旧违规边增加私有symbols或export*不再被旧债务吞掉。角色和功能迁移只通过明确path mapping，禁止手改JSON接纳候选违规。
- 当前扫描含未跟踪源码；拒绝私有路径和祖先软链接，不执行被扫描代码。
- 新建及实质修改文件立即核对首实质职责段、分类字段、位置和真实文档链接；裸规则卡路径也检查。TS/TSX、MTS/CTS及维护脚本包含在内。AST只证明形式，文字真实性由人工审查。

## 审查与验证

原独立审查提出15项red，全部修复并维护化：import=漏扫描、private/index、domain/verifier/生产测试边界、kind/symbol债务扩面、workspace应用包、baseUrl与extends、脚本职责、越界package出口、metadata包循环、裸规则卡路径。提出者原输入最终15 / 0，维护33 / 0；tooling类型0。原red和修后日志分别保留，参见 [原审查](architecture-gates-review.md)。

补全规则后由固定起点重推基线债务为1779（此前1762；变化来自规则补全，不是candidate whitelist）。C06候选首职责段已清零1项；阶段记录应区分committed树与包含C06 WIP的当前树。当前没有宣称zero debt或完整架构收敛。门禁余额及每格迁移责任持续用于P2–P9。

```bash
bun run lint:architecture
bun --no-env-file test tooling/refactor/architecture.test.ts
# 最终验收
bun --no-env-file tooling/refactor/architecture/run.ts check --strict
```
