# 后端测试的编译器模块绑定

本范围只修改 `backend/tsconfig.tests.json`。标准 backend 测试类型入口会检查从测试／脚本引入的 tooling 文件；其 `typescript` 导入按文件位置无法在仓库根找到安装在 backend 的包。tooling 自身配置已有显式映射，本配置原来缺少对应入口。

增加 `baseUrl: "."` 和 `paths.typescript: ["./node_modules/typescript"]`，绑定同一个已经安装的编译器；不新增依赖或更换版本。baseUrl 也建立 backend 相对的裸模块查找基点，paths 精确匹配模块名，不能声称任意裸模块环境在编译时完全等价。当前正常入口实际检查通过，严格选项、包含范围及其它配置保持原值。该映射供 TypeScript 模块解析使用，不修改 Node／Bun 的运行 resolver 或应用行为。

## 验证与边界

实际前态为 `7654533073e46150ee7181e6de6bf49d5e3e211d`，完整 JSON 原稿与三项稳定配置／package 控制已捕获。删除两项新增选项后，所有原 parsed 配置精确相同。正常 `tsc --project backend/tsconfig.tests.json --noEmit` 首次在修复后完整退出 0：83cee3／session87906→394068，完整输出为空。

此前 F05b 的正常入口真实退出 2，原日志不改。本次验证新配置入口，未重复那些有限绿色类型根、角色案例、证明或结构门禁；没有添加镜像测试、修改角色规则、语言、fixture 或模型接入。JSON 文件不植入非标准注释，职责说明由本维护文档提供。完整 P9 门禁与普通源码构建仍按目标后续执行。
