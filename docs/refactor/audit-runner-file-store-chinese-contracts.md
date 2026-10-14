# 审计任务与录制文件中文契约

本批只修改 `audit/task_runner.ts` 与 `recording/file_store.ts` 的16处注释；末两处同位精度／缩进校准单独承接首证据。before为实际 Git `da80c18f6d2fcbbc592a9198b4fc1382f63cc338` 两份全文；真实调用方 `audit/pipeline.ts` 和 `recording/session_recorder.ts` 两源与Git及当前全文相同。构造、类型、字段、方法、日志前缀、模型原文、默认语言与接受面均不变。

## 当前职责

Runner每次run持自己的共享cursor和结果数组：领取原index先推进cursor，再调用／等待任务；结果按原输入index返回，单个失败不把领取放回。并发和次数数据保调用方原引用，没有新增数字校验／clamp；每轮条件读maxAttempts，每次执行读取timeout，期限交原executor。原payload只在未提交findings时沿原告警→缩减→赋值；请求错误不主动缩减。首告警或缩减抛错进入原catch，该catch内诊断／告警再次失败仍可能让worker／run拒绝，不承诺总有失败结果。执行器创建、关闭及会话责任仍pipeline持有，Runner不提交游戏工具或操作录制。

Store构造不创建目录，initialize只在上层原调用点递归创建players。单个目标用固定同目录`.tmp`，先writeFile再rename；不提供唯一临时名、同路径并发隔离、多文件事务、自动清理或终档完整性。JSON.stringify作为方法实参在write的catch外求值，编码错误仍拒绝；宽write只包原writeAtomic查找／调用／等待，告警再次抛错仍传播。严格写把原编码和写入错误交调用方，上层仍聚合必需文件失败并拥有会话与归档顺序。

## 证据与限制

唯一完整证明 b85601 退出0：两个程序607 typed节点、742非注释叶全同，四份完整ESNext／CJS无注释输出逐字相同，16个精确comment编辑从完整Git原稿正演到首采样源（Store为e430f739阶段），末Store由下述两comment桥承接到最终2c34adb3；Runner仍为首采样原字节。遍历回调明确void，不只读首child，不使用template文本scanner屏蔽产品字符串。

Root全文审查后仅校准Store类说明为“初始化与终档写入时点归上层”，避免暗示Store持有close资源，并将strict方法JSDoc还原类内缩进。末782802退出0：完整247typed／320叶与两raw输出同，精确两comment正逆连接原Store绿色阶段；Runner全文不变，不重复原证明／头／类型／测试。

唯一职责头检查1a9def退出0：两源与当时618个真实Git MD路径，诊断0、缺中文头0。该有限形状检查不证明文字真实；任务资源、失败顺序与文件边界须由非作者全文及真实caller审查。没有类型、业务测试、模型、对局、全门禁或同输入绿色重跑。

原生成proof.json的limits首句复用了“审计证据／摘要模块”标签，实际证明范围由其programs两条完整路径、before／after SHA和输出明确定义为Runner／Store。保原执行script／artifact字节，不将该标签冒作另两模块验收，也不为文字标签重跑证明。

本批属于随重构维护中文说明，源码真实hash变化但不回写历史档案身份；不声明全仓中文覆盖或P9完成。

[范围](generated/audit-runner-file-store-chinese-contracts-scope-final.json) · [证据](generated/audit-runner-file-store-chinese-contracts-evidence.json) · [收据](generated/audit-runner-file-store-chinese-contracts-receipts.json)
