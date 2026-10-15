/**
 * 提供镜女原生查验实例选择与默认数据工厂的出口。查询按原顺序从能力库存中选择
 * 镜女原生来源，返回同一实例；默认工厂只生成新的空历史数据，不安装或补充资源。
 * 初始化与展示消费同一选择规则，赠予／复制查验不会替代原生文案，不据文案授权动作。
 * 输入为原角色或无参工厂调用；仅允许原生选择与数据创建，失败不在出口补装资源。
 */

export { nativeMirror } from "./native-inspection";

export { freshMirrorInspectionState } from "./native-inspection";
