/**
 * 负责提供默认预览的空自定义图层注册表。输入为构建入口选择，输出供前端消费的类型化组件集合。
 * 显式单局预览由 Vite 选择项目模块；组件不从计划 JSON 恢复，本模块不读取磁盘或修改事实。
 */
import type { VideoLayerRegistry } from "@ai-werewolf-arena/game-media/video/plan";
import type { VideoThemeSlotRegistry } from "@ai-werewolf-arena/game-media/video/theme-renderers";
const layers: VideoLayerRegistry = {};
export const themeSlots: VideoThemeSlotRegistry = {};
export default layers;
