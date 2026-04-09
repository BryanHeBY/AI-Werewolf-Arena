import { bootstrapGame, BootstrapResult } from "./bootstrap";
import { BoardConfig } from "../domain/model";
import { sixPlayerMvpConfig } from "../scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../scenarios/twelve_player_standard";

/**
 * 轻量容器：对外提供常用板子的一键装配入口。
 */
export class GameContainer {
  /**
   * 生成 6 人 MVP 对局上下文。
   */
  createSixPlayerMvp(): BootstrapResult {
    return bootstrapGame(sixPlayerMvpConfig);
  }

  /**
   * 生成 12 人标准局对局上下文。
   */
  createTwelvePlayerStandard(): BootstrapResult {
    return bootstrapGame(twelvePlayerStandardConfig);
  }

  /**
   * 使用外部传入的板子配置装配对局上下文。
   */
  createCustom(config: BoardConfig): BootstrapResult {
    return bootstrapGame(config);
  }
}
