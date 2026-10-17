/**
 * 负责按既有场景与typed意图选择广播版式。输入为单个已编译scene，输出渲染分支名称。
 * 不改变scene来源、结果、目标或事实时钟，未知意图沿用原notice回退。
 */
export { broadcastSceneLayout } from "../../scene-classification";
