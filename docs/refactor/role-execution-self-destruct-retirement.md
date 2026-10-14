# 身份安装失败后的狼队执行与自爆退休

本批为独立 F05a 行为政策。实际前态是 Git `bd2e04894509f7777d2909632f768a3329e3b57a`，四个生产源与已提交 cb57 原字节相同；范围另含一个新单元，合计五源。Root 拥有共同 `role-execution-authority.ts` 及两个身份安装 writer，本批不删除 `Role.camp`、更改构造参数、建立 Camp 镜像或提供恢复接口。

## 具体执行边界

- `wolfTeamPermissions` 保原 ready、Camp、婚约、Catalog callback 和 Nightmare／Scholar／Animal 阻断读取顺序。未退休结果保原返回对象；`NO_ACCESS` 单例身份也保，避免知识查询多读 World／Catalog。退休结果只关闭 `canChat`／`canVoteForKill`，`recognizedByPack`／`recognizes` 和原队友知识保留。新狼聊／刀受众仍由当前执行权限名单决定，不重写已冻结的历史受众。
- `canRoleSelfDestruct` 先执行原能力 callback 裸调用及其错误，再拒退休演员；未退休时保原 callback 返回值，不强加 schema 或额外真假归一化。
- 直接提交保阶段／婚约及原资格。普通／赤月在实际 Demon 付款前拒退休；白狼王在原库存和目标预检后、消费前拒退休。死亡名单只是提案，实际标死仍归原结算器；目标角色不因执行退休被过滤。
- 窗口保原并发请求和唯一 Provider await。新请求在原特殊资格／库存读取之后拒退休；等待后的 `stillCurrent` 保婚约、原 Role／生命、赤月权威、白狼王库存、目标生命次序，最后检查捕获演员的退休。没有成功 commit callback 等待后追溯否决或退款。

Root 的私有 WeakSet 按 Role 对象身份永久记录安装失败：字段恢复和跨 World 复用同对象不恢复执行，新 Role 对象仍须原许可。未退休只是一个拒绝条件未触发，不代表有权行动。正常 Camp 变化不自动标记，纯 World／数据／目标／档案查询及 last words／badge 不在本批过滤范围；已付效果的原体复验仍保原 owner，不加该信号。

## 首次有限验证

- 新单元仅两条不同案例，首次 `133931 / exit 0`，29 断言。普通狼与真实赤月关闭夜验证退休后拒直接执行、知识和原数据保；白狼王验证 Provider 真正 pending 时退休、fresh 窗口与 direct 提交拒绝、库存不耗，原库存 getter 的同 Error 仍先传播。没有重跑旧绿色场景。
- 五根类型 `b2a55e / session 26589 → 92ee66 / exit 0`；空日志不作为退出证据。五头 `229ead / exit 0`，当次 690 个 Git 文档，无诊断。
- 完整范围证明 `08d48e / session 40692 → 37124e / exit 0`：四个原程序 2,243 typed nodes／296 NodeArray／2,619 非注释语法叶，15 项精确编辑逐字正逆，八份逆向完整 ESNext／CJS 输出同；六个实际演员 guard、五个共同信号 binding 和原读取顺序另核。新政策的实际 JS 不同，逆向证明不意味着运行等价。

这四项首成功检查之后源码未变，没有首红或绿色重复。静态准备阶段曾修新单元的真实导入与 `NO_ACCESS` 单例保持；首次 SourceReady 样另存。Root 首 17 源 fence 的新单元为 d522；检查前补一行 `await Promise.resolve()` 后为 e249，使退休发生于实际等待区间。Root 显式批准 e249 的首次检查，更新 fence 与最终五源相同；首 fence 和完整微任务前样保留。Root 自己的新 unit 的失败类型修复不是本批运行或源码变更。

## 限制

类型与 binding 消费全组 source-ready 联合工作树，不是整个固定 bd2 闭包。共同 Core 和并行 writer／资源／枪组属于各作者；六个稳定控制源按本批真实 Git 核字节。新退休分支采用现有权限对象展开方式，只屏蔽两个执行字段，不承诺任意自定义 Proxy／getter 或模块重绑定的历史访问等价。此处不运行全门禁、全套类型、旧场景、模型或私有配置；不声明全部 55 族、Camp 单权威或 P9 完成。当前源码参与新构建指纹，历史严格档案政策不豁免。
