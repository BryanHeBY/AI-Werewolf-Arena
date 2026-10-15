/**
 * 持有 Mist／Raven 测试板子输入加载及固定身份／变体声明；输入为跟踪的 configs.example 公开板子 JSON，输出为原解析后的定义，保留既有 readFile／JSON／板子解析路径。不写文件、不运行游戏或模型、不计算结算预期；预期仍由手写数据给出。
 */
import { Role } from "../../../../../src/domain";
import { readFile } from "node:fs/promises";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";

export const MIST_ROLES = [
  Role.Alchemist,
  Role.Seer,
  Role.Dreamer,
  Role.Idiot,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.Villager,
  Role.RavenClawWolf,
  Role.Wolf,
  Role.Wolf,
  Role.Wolf,
] as const;

export type MistRecordVariant =
  | "linked"
  | "saved-dreamer"
  | "protected-heal"
  | "draw"
  | "pure-saved-dreamer"
  | "consecutive-heal"
  | "ordinary-double"
  | "mixed-order"
  | "self-heal"
  | "blast-pre-election"
  | "blast-daybreak"
  | "blast-speech-gap"
  | "blast-pre-vote"
  | "blast-raw-target"
  | "blast-badge-chain"
  | "blast-last-wolf"
  | "blast-parallel"
  | "blast-parallel-raw-loser"
  | "blast-parallel-second-gap"
  | "last-villager-pass"
  | "last-villager-heal"
  | "last-god"
  | "last-god-illegal-self";

export async function mistBoard() {
  return parseBoardDefinition(
    JSON.parse(
      await readFile(
        new URL(
          "../../../../../../configs.example/boards/awa_mist_raven_12_v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
}
