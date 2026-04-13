import { bootstrapGame, BootstrapResult } from "./bootstrap";
import { BoardConfig } from "../core/domain/model";
import { resolveBoardConfig } from "../scenarios/board_config_resolver";

/**
 * 轻量容器：对外提供常用板子的一键装配入口。
 */
export class GameContainer {
  /**
   * 生成 6 人 MVP 对局上下文。
   */
  createSixPlayerMvp(): BootstrapResult {
    return bootstrapGame(resolveBoardConfig("six_player_mvp"));
  }

  /**
   * 生成 12 人标准局对局上下文。
   */
  createTwelvePlayerStandard(): BootstrapResult {
    return bootstrapGame(resolveBoardConfig("twelve_player_standard"));
  }

  /**
   * 使用外部传入的板子配置装配对局上下文。
   */
  createCustom(config: BoardConfig): BootstrapResult {
    return bootstrapGame(config);
  }
}
