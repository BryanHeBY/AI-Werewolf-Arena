import { bootstrapGame, BootstrapResult } from "./bootstrap";
import { BoardConfig } from "../domain/model";
import { sixPlayerMvpConfig } from "../scenarios/six_player_mvp";
import { twelvePlayerStandardConfig } from "../scenarios/twelve_player_standard";

/**
 * 轻量容器：对外提供常用板子的一键装配入口。
 */
export class GameContainer {
  createSixPlayerMvp(): BootstrapResult {
    return bootstrapGame(sixPlayerMvpConfig);
  }

  createTwelvePlayerStandard(): BootstrapResult {
    return bootstrapGame(twelvePlayerStandardConfig);
  }

  createCustom(config: BoardConfig): BootstrapResult {
    return bootstrapGame(config);
  }
}
