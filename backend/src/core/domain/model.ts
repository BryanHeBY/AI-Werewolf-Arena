/**
 * 负责按身份、板子、动作、事件、结果与死亡概念聚合领域出口；输入为各概念模块既有契约，
 * 输出保持原值／类型绑定，向领域调用方提供同一公共声明。
 * 具体契约仍由各概念及 game-contract 拥有，这里不定义第二套枚举、状态或规则。
 * 原重导出顺序和下游模块加载关系保持；出口本身不创建角色、授予请求权限或封盘。
 */
export * from "./identity";
export * from "./board";
export * from "./actions";
export * from "./events";
export * from "./results";
export * from "./deaths";
