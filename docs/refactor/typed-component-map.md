# C16：组件名称与对象类型的基础边界

ComponentMap 将原 11 个组件名关联到原接口。默认读取推导具体组件或 undefined；默认写入从 name 推导 K，值不能反推更宽的槽位。公共独占字段阻止错槽和 Role/Camp 混用，共同 renderPrompt 及自定义额外字段保留。

World 仍拥有同一份 Map，读取返回原 mutable 对象；组件工厂、生命版本和权限 current callback 原样。固定 `dd23d71` 的 17 个运行方法、全部私有字段和整个类型擦除后的 World 模块逐字一致，未加运行校验、copy 或 freeze。

兼容入口仅对显式旧 T 开放，默认 fallback 的 NoInfer/never 不接受错误输入。该入口按 C44 清除；当前不能宣称所有调用已得到完整强约束。316 处源码及 820 处测试的单行泛型搜索只是待核调用线索，最终以 AST 实际 consumer 台账为准。

3 个局部运行测试、21 断言与真实编译反例通过。实际 backend 源码类型通过；测试首轮发现原 9 文件/10 个 deliberate malformed/foreign 组件注入，已明确用显式 unknown 测试写入，输入与守卫不变，每份类型擦除程序仍逐字相同，第二轮测试类型通过。这些测试特权在 C44 随旧入口统一收口，不能成为生产宽松写接口。

本基础切片没有迁 Role 私有库存、阵营双权威、提示渲染或请求租约。typed state slot 的唯一 owner 和实际 consumer 继续在 C17/P3 分批完成。
