# P9d 完整门禁：模拟 SDK 端点所有权修正

正式仍48/64。第三轮在 `c7bedab` 加两项目录候选上冻结2197公开输入，前后字节和SHA均相同：`e461ac3e164602ed95ac897a5086c50825443805d7c789ce99bddc7c19de928c`。静态检查通过；三个分片155／154／154文件各执行一次，6308通过、2失败、1条件skip、863115断言，无重试。尚未运行后续7份时序、前端、构建或浏览器，不称完整验收通过。

## 两份失败与可构造的交互

原始目录 `/tmp/awa-p9d-noble-candidate-full-third`：

- `scholar_mentor_transport` 的 both-wolves/llm：模拟HTTP服务读取不存在的 `plan.turns`。
- `time_consort_failure` 的 wolf_discussion/missing/acp：关闭所有权探针收到HTTP400，而严格探针要求原监听器已拒绝连接，或旧token被新owner明确拒绝。

共同模拟SDK入口原先使用所有局相同的key，且不校验鉴权，直接解析所有路径的JSON。旧控制探针会POST `/invoke`，携旧MCP token与schema查询，不含model；若它的已释放端口被新SDK fixture使用，该请求就令actor变成NaN、plan为空，污染新局失败数组并返回400，同时使旧探针失败。代码可以确定性构造这条路径；原日志没有端口及请求来源，**不能声称已从日志证明两项来自同一个socket**。

## 修正与明确边界

仅修改测试模拟服务。每次对局生成独立synthetic UUID token，SDK provider与HTTP入口共享该token。鉴权在路径和JSON解析之前进行：不属于当前owner的请求先返回精确401 `ok:false/error:unauthorized`，不进入业务、不消费动作、不污染协议失败数组。当前token仍走原业务处理，错误JSON或协议继续400并记录错误。

关闭探针的判断、其反例测试及生产 `LoopbackMcpControlServer` 均未修改；400／404／409／200等仍不能当作已关闭，没有通过重试或放宽错误来隐藏问题。

## 确定性复验与交叉审查

新维护用例先启动真正控制server，确认原token仍可达时探针失败；关闭后强制模拟SDK接管同一端口。旧探针得到different-owner，旧MCP／另一SDK／无token加坏JSON均401，解析计数和失败数组保持0；当前token的正确请求实际执行，坏JSON仍400并记一份失败。

新同端口用例、既有严格探针，以及两份原失败整文件合计 **48通过／0失败／9587断言**，`/tmp/awa-synthetic-owner-closure-fixed.log`；测试类型退出0，`/tmp/awa-synthetic-owner-types-final.log`。这是修正后的独立定向回归，不能混为第三轮全绿。

A只读核真实wrapper、每局token及provider一致、鉴权先行、合法坏请求仍失败；按第三轮输入hash确认探针／探针反例／生产控制server未改。独立终态报告 `/tmp/awa-p9d-noble-candidate-full-third/a-review-third-terminal.json` 核463唯一header、footer、退出码、未运行门槛及2197字节闭环。原意见无剩余本片阻断。第四轮继续全部支持范围冻结验收，完成后再正式登记贵族／觉醒愚者；P9d余项、P9e／P9f和P10仍推进，不push。
