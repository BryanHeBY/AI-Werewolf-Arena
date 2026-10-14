/**
 * 负责向引擎、角色与应用公开现行领域所有者的原绑定，输出存储、组件工厂、运行端口与数据声明。
 * 本入口组织重导出；实体创建、规则登记和阶段推进仍由对应所有者完成。加载依赖时仍执行
 * 原模块的初始化，不能据此推定所有被导出模块都没有顶层副作用。组件类型映射关联原存储对象，
 * 重导出不裁剪、序列化或替换这些对象；以下保留出口及其排列顺序共同构成当前公开边界。
 */
export * from "./model";
export * from "./action_request_context";
export * from "./random";
export { World } from "./world";
export type { ComponentMap, ComponentWrite } from "./component-map";

export * from "./components/alive";
export * from "./components/badge";
export * from "./components/camp";
export * from "./components/names";
export * from "./components/role";
export * from "./components/status_marks";
export * from "./components/voting_right";

export * from "./entities/player";
export * from "./registries/condition_registry";
export * from "./registries/role_registry";
export * from "./systems/damage_resolution_system";

export * from "./components/victory";
export * from "./components/lovers";
export * from "./components/debate_penalty";
export * from "./components/wall_note";

export * from "./request_delivery";
