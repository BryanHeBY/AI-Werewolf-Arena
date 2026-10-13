# C30 借用实例公共 metadata 写权

实际来源 `920eac7b`。两个生产 owner 与一个新单元测试的最终摘要、真实收据和独立审查见 [固定证据](generated/borrowed-ability-metadata-owner-evidence.json)。

## 实际职责

Eclipse 借用安装本来就由 `grantNightAbility → installAbility` 持有，不新增包装。原 `closeRadiantNight` 唯一漏出的公共 metadata 写，现在归既有 `ability_changes` 的具体 `retireBorrowedNightAbility`。

Frame 仍保有租约、原体／生命版本／捕获槽资格、抑制关闭、库存和已付 payload；只有原 disabled 描述符写移到实例 owner。没有第二 store、ID 重查、source 改名、payload 复制／重置、delete／退休 ID 或新增启停事件。

## 顺序与失败

目标 supplier 在 `Object.defineProperty` callee 查找之后才读取原 `l.borrowed`。原四个描述符字段保持；替换的 disabled getter／setter不执行。错误仍在后续租约／恢复事件发布之前传播，不默默跳过或退款。

抑制关闭尝试仍先执行；它可能返回 false 并保留 marker，因此不声称原主已成功恢复。该中文过强措辞在独立审查中修正，仅改变注释摘要，不重原类型／行为验收。

## 有限验收

- 新 `3 pass / 0 fail / 15 assertions`：同捕获引用、变 ID、描述符与零访问器、callee／supplier 原顺序与错误、不可配置字段失败不改 payload／事件。
- 原有界 `5 pass / 0 fail / 13 assertions`，14 filtered：真实 Frame 中止、库存／source、变 ID、替换／复活和 getter 边界。
- 严格有限 types session `29847` 作者实际终态 `0`，原配置不放宽。
- 两个完整源经唯一写调用精确逆迁后 ESNext／CJS 程序同真实 Git；原模块依赖边、完整 descriptor 同。三个中文职责头及关键状态／顺序说明通过。
- Root 实际阅读两 owner 和全部新测试；独立方向核真实 Git、完整非 import 程序、最终三 SHA 与中文说明，无待修项。未重复 runtime／types。

tracked 源 diff 检查为 0；作者对新文件的 no-index diff 退出 1 是正常新文件差异且无空白诊断，不当作退出 0。本批归档 schema2、source copy 标签及具体规则均保持；未运行全套、整局、网络或模型。

本批闭合现有借用实例的安装／退役 metadata 写权，具体借用授权／租约和其它 C30 族仍需后续汇合，不标记整个 C30 完成。
