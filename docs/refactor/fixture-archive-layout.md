# 成套归档目录与实际消费者

## C14 实体迁移

904 份原 JSON 归档按实际 owner、已记录 board、原 scenario、已记录 locale 归档。没有记录的 board/locale 使用明确的 unrecorded 目录名。God、checkpoint 和 player 文件按已核验 cohort 放在一起；原 checkpoint.txt 的内容保持，只将扩展名规范为 JSON。

258 个稳定 suite ID 保留，256 个局部 manifest 是全局表的精确子集。包含 253 个前端 cohort、两个 replay-contract legacy standalone cohort 和一个 ACP fixture 目录；两个 legacy God/player 输入没有被虚构成一局关联档案。

Root 独立从固定 Git blob 逐字核对全部 907 个来源和当前摘要：904 份归档内容完全不变，904 个旧实体路径已移除。三个可执行 source fixture 的原/现摘要不同且程序保真，已在前笔单独收口。

## 加载边界

最终 74 个实际补丁包含 66 个 TS/TSX 消费者、七份活动 Markdown 和全局清单。静态 import 指向实际新文件；动态 I/O 通过稳定 origin 选择 currentPath，保留原条件、basename 和 suffix。两个 God 浅扫描仍读取原 253 份输入，Radiant owner 扫描仍读取原 112 份 player view，不把新 manifest 当作 replay。

交叉审查找到并修复 15 个文件中的 17 个目录模板头引用。CLI 的一处旧 sample 字面路径也已迁移：它在拒绝非法 frame 前先读取输入，不能当成无物理依赖的负例。其它矩阵、临时输出配方、合成非法路径和 43 个非归档消费者保持原样。P0 历史文件路径继续作为历史证据，未重写。

所有 metadata 仍区分实际文件来源与 producer build。258 个 seed 和 build 均未知，69 个 policy 未记录，全部 acceptance 仍为 pending-review；目录和 SHA 不是对局规则验收证据。

## 局部验证

作者与独立审查的全部 66 个程序比较通过，仅允许具体路径、helper 和三项扫描替换；65 个原矩阵逐字保持，CLI 单一 sample 路径单列。66 个职责头及真实类型项目通过。原 CLI 三项通过；实际 loader 读取 Animal、Fragrant、默认 sample 和两种 Knight 输入成功。Playwright 仍发现原 362 项、23 个文件。

实际 `check:fixtures` 验证 907 个 artifacts、904 个原字节归档、三个 source fixture、五个 source 程序、258 个 suites 和 256 个局部 manifest。没有重生成 golden、调用模型或重复全量游戏/浏览器测试。大阶段固定输入门禁继续按约定集中运行。
