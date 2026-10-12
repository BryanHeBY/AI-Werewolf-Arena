# C11：前端事实与投影测试归属

25 份前端纯事件/投影测试迁到 unit/replay/events 或 projection；17 个 Scholar/Mentor 纯读取用例迁到 game-contract/tests/unit/facts。没有搬位置绑定的渲染、目录扫描或复杂文件加载测试。

26 文件、206 个原用例 ID 保留。独立审查直接比 `dd23d71` 原文件：非 import 正文、标题和矩阵逐字相同，50 条相对 import 经 TypeScript 解析及 realpath 确认指向同一模块。旧路径退出，现有递归 unit、包测试和根 workspace filter 已覆盖新路径。

职责头按实际验证目的写：canonical full/own 读取、语言标签、原字段关联、seek 因果或档案投影。审查发现通用头误称 Scholar 有渲染和 Nightmare 有语言矩阵，已改准确输入/输出并重新核对 SHA，测试正文未改。

必要 frontend 与 game-contract 源/测试类型通过，未重复运行 26 套旧测试。统一迁移清单现为 108 个文件、1241 个唯一原展开 ID；这是迁移发现证据，完整测试仍由集中阶段门禁执行。
