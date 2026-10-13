/**
 * 负责测试 Promise 玩家档案输入的 parser 捕获与 canonical 转换；输入为调用点已取得的原 JSON parser。
 * 输出为兑现时的解析处理器，唯一持有该捕获函数；parser 以原单参数、bare-call 接收方执行，随后由既有 reader 解包。
 * 此工厂不读取文件、生成预期或推进对局；调用方在原 .then 参数位置取得 parser，不能延迟查 JSON.parse。
 */
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";

export function mapPlayerArchive(parser: typeof JSON.parse) {
  return (raw: string) => readReplayPlayerView(parser(raw));
}
