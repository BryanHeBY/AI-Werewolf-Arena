/**
 * 负责启动本地 mock smoke 命令。输入为进程参数，输出沿用 CLI 的日志与错误退出处理。
 * 实际六人局和特权基线驱动归 run_mock_game；本入口不调用模型或生成独立规则验收预期。
 */
import { main } from "./runtime/run_mock_game";
import { runCli } from "./runtime/cli/display";

void runCli(main);
