# 玩家轮次录制的应用适配

本批把 `PlayerRoundRecorder` 完整类从 AI 共用目录迁到 `app/player-round-recorder.ts`。应用层负责当前 World 身份到录制输入的适配及唯一玩家计数；AI 继续交原请求、提示和选择结果。Session aggregate 与 FileStore 不取得 World，也不决定游戏行为。类没有任何具体角色结算算法。

## 输入与失败顺序

没有录制作用域时立即返回，不读请求或 World。存在作用域时，先按原 actorId 查询当前角色，再读取／递增玩家计数，然后读取请求 day、phase、stage；构造原录制字段后交同一 session recorder。actorId 不缓存，Date.now 与原文字段读取保持原位置。后续请求 getter 或录制失败保留已递增计数；tool accepted 与 finalAction 不表示已付款或已生效。

三条真实 AI 引用和三条原测试引用（含两个动态 import）直达新应用入口；其中 LLM TurnOrchestrator 只在类型位置使用类，运行导入被擦除。AI 的旧叶及 barrel 类出口退休，backend root 通过 app 继续公开同一 canonical 类；没有兼容转发文件。AI 提示数据只作为类型依赖，不把模板实现引入录制运行。它们的完整公共协议归属后续继续整理；本批不宣称 AI 其他 World 依赖已清零。

## 验证与限制

真实 `2117e497` 的九个原文件与新 owner 构成十路径范围。完整类类型程序相同，明确导入路由逆后的两份运行输出相同；七个现存 consumer／出口的保留程序及十四份输出相同，app 原其他出口不变。实际九个存在文件的中文职责检查无诊断。源码和接口证据见[完整记录](generated/player-round-recorder-owner-evidence.json)。模块加载根与旧叶 API 确实改变，不宣称旧模块路径兼容或整个冷加载图相同。

九个受影响根的有限类型检查实际退出 0。原文件录制两语言用例 2 项通过、20 断言；原 ACP 关闭 trace 单例 1 项通过、3 断言，另 9 项过滤。两次测试共三个不同用例，没有运行付费模型或全量检查。

检查完成后仅澄清四条纯类型 import：显式 type，以及 ActionRequest／EntityId 指向既有共享类型所有者。完整类及运行输出复核保持，未重复已绿类型或测试。新路径、注释与出口进入新的来源指纹；历史档案原来源不回写。
