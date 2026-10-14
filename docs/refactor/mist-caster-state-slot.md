# 雾鸦施法者状态绑定的完整 owner

本批 C17 分离炼金魔女／狼鸦之爪的状态检查点与原参与者授权，不改变有限雾鸦板的玩法。

## 范围与实际资源

真实修改前 Git 为 `d589dfbdb79797d2afcfd9c18d7efe60b5675328`，两旧源与 Git 字节相同。四源为 state、caster_authority、新 state-slot 和新 prefix 单元。night_frame、profile、night_stages、player_projection、ports、旧 caster 单元六份控制全文保持 Git 字节。

每个实际 Authority 的唯一 binding 原封迁入 state-slot：raw 原对象、脱离副本 JSON 证据、历史／队友数组、每行和嵌套 targetIds 引用。没有新增 Map／WeakMap 或库存镜像。原 reader 保持脱离副本；相同 JSON 新数组／新行／新 targets 不能续权。两原 factory、两 reader 与选择／解封函数全保。原 own descriptor helper 真正归 state，Authority 与 slot 两真实 caller 共用，未复制规则或新增 schema。

Authority 保留原角色、阵营、Identity、原生命版本、day、allowFirstDeath 和 ravenChecked。只有参与者／生命前缀通过后才读状态检查点。current 成功后仍再次调用 reader，不缓存副本或提前读取 caster／容器／key。阶段、closed、目标与已付款关系仍归夜 owner。

四 install(next) 调用直接新 owner，构造时只创建同一原 current 复验闭包、不执行它，调用者不再可选校验源。安装时才查找原 current 并保留其 receiver；实际许可仍由原 authority 拥有。不留旧 read／bind／install 转发。完整顺序为现场授权 current → bind(next) 的 reader／JSON／逐层引用准备 → Object.defineProperty → binding 替换。属性写的 callee 查找保持先于现场容器与 key。失败保留原错误和已经写入的前缀，不回滚库存。ravenChecked 在 current 通过后先写，再执行可能失败的 unseal／install；失败也不能重开夜初检查。

## 精确行为与 API 差异

新 slot 通过实际查询 thunk 晚读原字段和实际 current，回调不提前缓存 World 或换 receiver。原首次死亡仅允许读取保留知识／已付款效果，不能新增付款；复活和替换原体仍撤权。

Authority 的 JS 私有 read／bind／install／binding 布局退出，新 stateSlot 字段、新 class 和静态导入边有意增加。原公共 class 方法、参数和行为保留；不承诺私有反射、方法覆写或旧 CJS 反射入口兼容。slot 没有 World／life／clock 依赖，静态图为 Authority → slot → state，无反向新循环。

## 有界证据

- 实际新owner完整算法与完整保留区域：19项、5406强 AST节点及八完整映射输出通过，所有 child 均遍历。
- Authority整体2641节点、两个whole mapped输出通过：删除的read／bind／install body实际取自新slot，按明确接口映射组回，未恢复旧整个body后宣称等价。构造前缀、末原槽表达式、三现场thunk、四caller完整参数和原授权guard独立核对。当前全模块raw不是全部相同，新增class／导出／加载差异不遮蔽。
- 新八case／27断言：解封失败与冻结槽失败均保检查前缀；实际写之后抛错保新库存并撤旧检查点；初JSON失败原库存不变；十二caster晚读、四JSON和一次写的字面轨迹；同字节数组／行／targets替换撤权。旧首次死亡精确case仅一次1/0/5，25filtered。首批合计九不同case／32断言，分两执行。Root收口建议将原current复验thunk移至唯一构造query后，仅再次验证字面晚读case 1/0/2（7filtered）与受影响单元root76685／bdbb29实际exit0，不重复其余既有绿例。
- 有限四根首session67022／80f5e1实际exit2，只新unit八个object字段类型诊断；纯cast两whole单元JS同后，仅失败root65594／15934d实际exit0，未重复三生产根或runtime。
- 四职责头实际checkComments 0，中文presence另4/4。raw与detached区别、逐层身份、写入／raven失败前缀和授权边界均有就地中文说明。

首证明harness漏掉旧RavenKnife单参数调用的末逗号，完整AST拒绝；只修精确映射，首失败保留。没有运行全量门禁、整局、模型或黄金更新，不宣称整个C17完成。

[证据汇总](generated/mist-caster-state-slot-evidence.json) 包含完整脚本、真实before／control、SHA、类型终态及测试日志；[冻结](generated/mist-caster-state-slot-scope-final.json) 与 [完整程序](generated/mist-caster-state-slot-whole-authority-proof.json) 供独立三方面审查。

末数据结构注释增量保存两份修改前完整源码：明确 raw 身份、JSON 内容证据与各层原引用的区别，及两种实际资源／历史／知情语义。两完整非注释程序与四 whole 输出保持；原验证与职责头收据保留原阶段，不为注释重跑类型或运行测试。最终 scope 已更新，历史身份不重写。

第三同行将狼鸦之爪的首觉醒说明明确为原存活狼少于三人条件；只有一条注释精准替换，完整3012非注释节点和两 whole 输出保持，验证收据不重跑。
