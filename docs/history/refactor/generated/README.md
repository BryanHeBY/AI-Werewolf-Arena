# P0 公共输入与发现清单

这些文件由 `tooling/refactor/inventory.ts` 生成，基线为完整动物梦境交付提交 `27a97cb66e8f30fceb7cb20130154291559dd14a`。它们只登记不可变的公共 Git blob，不执行业务代码、测试回调、配置读取或模型调用，不包含本机认证与私人配置。

| 清单                        | 内容                                                                            |
| --------------------------- | ------------------------------------------------------------------------------- |
| `baseline-inventory.json`   | 2,343 个公共输入的 Git blob、SHA-256、字节数和路径；1,278 个 TypeScript 文件    |
| `baseline-test-cases.json`  | 616 个发现文件、runner、2,767 处 AST 声明、参数化表达式与历史实际展开的用例身份 |
| `baseline-fixtures.json`    | 907 个 fixture/snapshot 文件的原始字节摘要与消费者字符串线索                    |
| `baseline-source-hash.json` | 当前 engine 指纹的六个扫描目录、401 个被覆盖 `.ts` 与 173 个未覆盖源文件        |
| `baseline-contracts.json`   | 三个共享包的真实出口、导出声明、应用入口、领域契约和根任务                      |

## 实际用例证据

展开用例来自 `/tmp/awa-p9e-animal-complete-full-first` 的最后一轮完整离线验收。生成器要求 `inputs.before.json` 与 `inputs.after.json` 的公共执行输入成员和字节摘要完全一致，并把全部 2,340 个执行、测试、fixture、配置示例和依赖输入与基线 Git blob 逐一核对，零差异后才采纳标题。Git 执行输入全集必须被覆盖，包括根 `package.json`、`bun.lock`、`bunfig.toml`；两份清单同时遗漏入口也拒绝。另有 278 个文档与非执行输入未用于旧验收复用；它们不被当作该轮执行的代码证据。

| runner        | 文件 | 展开的用例 | 状态                                      |
| ------------- | ---: | ---------: | ----------------------------------------- |
| backend       |  514 |      6,907 | 6,906 pass；1 skip                        |
| frontend-unit |   79 |      1,205 | 1,205 pass                                |
| chromium      |   23 |        362 | 成功完整运行中的 362 条项目/位置/标题记录 |

清单保存 before/after 输入清单及每份日志的 SHA-256，并核对各日志最终用例数量、文件数量、零失败与完整发现覆盖。Bun 会在末尾再次列出跳过标题，生成器明确排除这次重复。Chromium 条目使用 `listed` 表示来自成功完整运行列表；不伪称逐用例重新执行。

这是基线证据复用，未重新运行完整套件。1,075 处 AST 标题表达式尚未静态展开；1,082 处声明具有 `.each` 或外层循环等参数化线索。AST 声明包含 `describe` 容器，不能用声明总数替代实际用例数量。实际展开身份另行保存，重复标题具有独立 occurrence。移动后的比较必须应用批准的路径映射，同时保留标题、出现次数、参数矩阵和输入字节约束。

## 指纹与引用边界

实际 engine `sourceHash` 为 `b603ece35929ad44b8dae7caf3738d8e2ca41e9f5ffd3020c3b105d1db55c8e0`，`lockHash` 为 `a1b89a515c7c53f434767790fd01be93bccfa6461e6a1deb15c3a139db95f074`。生成算法与现有 `currentEngineVersion()` 实际输出一致。当前 engine 指纹没有覆盖 AI、runtime、recording、audit、前端等全部构建输入；本清单明确登记这个范围，不宣称是完整构建身份。

fixture 引用分为可解析的字面路径和 basename 线索。模板字符串、目录扫描及运行时拼接可能有额外消费者；没有字符串命中不意味着 fixture 可以删除。原始字节摘要适用于后续成套移动验证，不能通过重新格式化 fixture 改写原始基线。

## 重生成与局部验证

```bash
bun --no-env-file tooling/refactor/inventory.ts \
  --commit 27a97cb \
  --evidence-directory /tmp/awa-p9e-animal-complete-full-first \
  > /tmp/awa-refactor-inventory.json
bun --no-env-file test tooling/refactor/inventory.test.ts
```

CLI 的标准输出只有组合 JSON；失败只输出稳定 `inventory_*` 分类，不打印原始 Git 或传输错误。缺少 after 清单时拒绝采纳历史用例，不宣称固定输入验收。未传入历史证据时仍可生成公共 blob、AST、fixture 和出口清单，实际展开用例为空，不能据此宣称完整发现验收。私有路径、遍历路径和被纳入范围的符号链接均拒绝。
