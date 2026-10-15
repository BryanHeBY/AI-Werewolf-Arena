# 重构最终固定输入验收

受测源码 `60fdbfbc57122eeb1d4e9204b66d4daec1eb0157`，公开输入 manifest `08cb4b2ba9640566b28b9610ea22c1602d40eee811c47be282128ca8618b591e`。全部 42 个原子命令在该固定输入、净环境和相同工具链下实际完成，原始输出、Git／来源首末检查和完整命令见[收据](refactor-final-acceptance.receipts.json)及[证据封包](refactor-final-acceptance.tar.gz)。14 个类型项目、两个构建、各层测试及静态门禁分别保留，不重复运行根聚合任务累加结果。

## 实际测试输出

共 `43` 次实际尝试，42 个命令 ID 取得成功终态。若有前次失败，同输入人工重试须有原始原因、收据和退出记录；各次结果独立列出，不叠加重复用例。

Chromium 第一次尝试的 362 个用例均在浏览器启动时因 Unix `SingletonSocket` 路径过长而失败，未到达产品断言；显式重试只将该次及三项首次渲染的 `TMPDIR` 放到新建独占短目录，其他环境模板、源码、依赖、工具及命令保持。第二次相同 362 个用例全部通过。原失败报告、执行补充、逐键环境核验和独审均收入封包。

下表只列真实 Bun 末统计；未打印的计数为“—”，不补造零，也不将声明、断言和夹具调用混算。

| 命令                                 | pass | fail | expect | skip |
| ------------------------------------ | ---- | ---- | ------ | ---- |
| `backend-architecture` #1            | 38   | 0    | 231    | —    |
| `backend-integration` #1             | 350  | 0    | 4170   | —    |
| `backend-scenarios` #1               | 3345 | 0    | 934103 | 1    |
| `backend-unit` #1                    | 4117 | 0    | 36267  | —    |
| `frontend-architecture` #1           | 4    | 0    | 549    | —    |
| `frontend-integration` #1            | 8    | 0    | 89     | —    |
| `frontend-unit` #1                   | 1150 | 0    | 81278  | —    |
| `package-game-catalog-tests` #1      | 5    | 0    | 215    | —    |
| `package-game-contract-tests` #1     | 169  | 0    | 1329   | —    |
| `package-game-presentation-tests` #1 | 3    | 0    | 11     | —    |
| `package-game-text-tests` #1         | 8    | 0    | 3323   | —    |
| `package-replay-contract-tests` #1   | 27   | 0    | 133    | —    |
| `tooling-tests` #1                   | 103  | 0    | 300    | —    |

Chromium 实际展开统计为 `{"duration": 380427.124, "expected": 362, "flaky": 0, "skipped": 0, "startTime": "2026-10-15T12:49:44.191Z", "unexpected": 0}`，完整 JSON 保存在原始 stdout 中；不能把静态 spec 文件数当执行用例数。

## 中文契约、媒体与独审

严格架构门禁覆盖 3364 份文件，零违规、零未清债务；关键流程的中文结构、权限、生命周期、执行顺序和错误前缀另经人工抽核。完整计划与其有界实现仍由[当前职责矩阵](../../architecture/migration-matrix.json)和[支持边界](../../contracts/mechanism-support-boundaries.md)解释。

实际生成中文、英文 PNG 和英文 H264 MP4，并读取 ffprobe、人工查看两图和视频解码的第 15／105 帧。该样本仅两个玩家、两个事件，1280×720；视频为 30fps、180 帧、6 秒。frame 0 字幕透明属于动画预期，样本不含昵称或终局事件，不宣称验证了完整十二人局或全部角色画面。

[三方面独审](refactor-final-acceptance.peer-review.json)核对架构与来源、规则与媒体、数据与验证边界。原 cb、07ef、f2 等失败／超时轮保留已记录的输入身份、首红／超时／早停终态及实际原始输出和未运行项；后继有限修复没有倒补旧轮绿色。场景组整组预算为实际已审 14400 秒，单用例与原发现集合保持。

本包先于最终文档元数据独立提交；后者不冒称同一整仓快照重新受测。42 命令通过与 843 个适用职责的有界接受是两种登记；67 项本地不适用须有业务理由，55 个运行 Role 不代表任意混搭支持。
