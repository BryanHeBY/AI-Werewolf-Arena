/**
 * 负责独立复盘网页的开发入口；输入 Vite 参数，输出应用服务的退出码。
 * 不要求预选归档，也不读写录制；工具根与子进程关闭由同应用的启动用例负责。
 */
import { startReplayDevServer } from "./replay-dev";
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
process.exitCode = await startReplayDevServer(undefined, args);
