# 测试发现与验证层迁移

C10先接runner再迁文件。前端保留unit与新增integration独立命令，默认test串联两层，23个browser specs维持原Playwright发现入口。backend当前递归tests / setup preload保持；packages与tooling已有独立owner runner。

首批是三份真实FS / CLI / renderer integration tests：replay-cli、replay-input、render-replay。新旧目录深度相同，原相对imports、URL与完整program byte保持，只补精确职责头。独立root再比Git2d36e4d的program三份完全一致；旧8个展开用例ID/title/path映射见 [台账](generated/test-path-mappings.json)。没有改fixture或oracle。

局部8 / 0、89 assertions，日志/tmp/awa-c10-frontend-integration-local-second.log。首轮C07并行公共出口尚缺的加载失败原样保留，不伪称case失败或改预期。无需Chromium/真实模型/全套验证。

后续每组按真实验证目的拆unit/integration/scenario，不能按角色名或原文件夹批量移动。静态628文件/8474旧IDs规划有168主责任待确认，分类是proposal，不是批准结果。fixture907成套搬迁前必须先改两处shallow-readdir及67动态loader并保证完整manifest字节集。

后端新增已有真实目录的 `test:unit` 与 `test:integration` 入口，显式保留 setup preload；默认 `test` 仍递归整个 tests，物理迁移期间不会漏掉旧目录。`test:scenarios` 在实际 scenarios 套件迁入时接入，不能先用空目录冒充发现。单独入口可以用于必要局部验证，大阶段才执行默认全套。
