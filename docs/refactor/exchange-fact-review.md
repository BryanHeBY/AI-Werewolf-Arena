# C08 Trickster / Order Prince / Magician 独立只读审查

审查 9 个作者文件：三份 contract fact leaf、三份 text named facade、三份 package tests。原始来源直接取 Git `1700e0e3cc20f5564953037f372de056e1f307f3`，没有用作者 proof 自证。

## 结果

本范围没有新 blocking finding。三个完整原 program 除职责头与 copyEventData import owner 路径外，逐字节相同。纯契约没有 runtime 原体、角色状态、deadline/window、effect 或独立规则算法；没有改 DTO key、nullable、数值限制、错误/null 行为或返回 prototype。

## 独立证据

`/tmp/awa-c08-threefacts-independent-byte-proof.json`：

- Trickster 原 program 保持，2337 bytes（import 路径改后 SHA `006300a6...`）。
- Order Prince 原 program 保持，1693 bytes（SHA `d7862903...`）。
- Magician 原 program 保持，2342 bytes（SHA `b06ab06d...`）。

`/tmp/awa-c08-threefacts-independent-runtime-proof.json`：只执行小型字面 reader 与 facade identity，对三组函数同对象及十项边界检查全部 true，未启动 transport、引擎、模型或完整测试套件。

## 保持的细节

- Trickster / Magician 返回 copyEventData 的 detached null-prototype fact。pair 为恰好两个 safe positive integers，严格升序；null pass 保持。MAX_SAFE_INTEGER 本身仍排除，前一整数允许；不以有限板子人数在协议 reader 中重解释此 ID 范围。
- Order Prince 的 revote/choice 仍返回新普通 Object.prototype 对象，不能为了统一 reader 都改成 null prototype。原精确 key 与严格 boolean 保持。
- Magician full payload 恰好 actorId/day/pair，own 恰好 day/pair；own 明确拒 actorId，full 明确要求 actorId。没有把 God payload 的 actor 字段原样传入玩家自己的事实形状。
- `missed=true && requestedId===effectiveId` 继续拒绝；`missed=false && requestedId!==effectiveId` 的原接受语义继续保持，没有在机械迁移中强化规则。
- 所有 catch 继续返回 null，未知 type 提前返回 null；accessor 值不读取，但 shared inert reader 的反射可触发 Proxy。Node 外层 hostile-object 拒绝仍是另一入口职责，不声称 browser reader 提供 Node Proxy 保证。
- text facades 逐个 named export 原类型/函数名；root/package subpath 暴露实际 leaf，不新增状态、翻译或 mapper。

## 测试与整合范围

三份新 package tests 使用 literal payload/negative，未调用生产 resolver 生成预期；tuple expectation 已由作者标成 `[number, number]`，不改变期待值或 reader 输出。sameobject/prototype/own privacy 通过独立小 proof 核对。

Root 的 10 文件真实 consumer import-only 接线、根类型/门禁与 source fingerprint 属于另外的整合审查。facades 仍存在是明确临时桥，不把这次搬迁标为全部旧出口已删除。未改作者源或运行大 suite。
