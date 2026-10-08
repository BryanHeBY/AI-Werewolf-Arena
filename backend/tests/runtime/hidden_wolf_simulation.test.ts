import {expect,test} from "bun:test";
import {loadBoardDefinition} from "../../src/runtime/config/load_board_definition";
import {simulateGames} from "../../src/runtime/simulation/simulate_games";
import {readReproduction,replayReproduction} from "../../src/runtime/simulation/replay_reproduction";
import {createTestTempDirectory} from "../support/temp_directory";
import path from "node:path";
for(const id of ["six_player_hidden_wolf","twelve_player_hidden_wolf"] as const)test(`${id}: restricted-observation seeds inherit real knives without pack chat and every complete game strictly replays`,async()=>{
 // Twelve-player all-active scripts win for wolves before inheritance; the existing
 // four-style mix on seeds 0–19 exercises actual inheritance and subsequent knives.
 const board=await loadBoardDefinition(path.resolve(import.meta.dir,"../../../configs.example"),id),report=await simulateGames(board,{seeds:Array.from({length:20},(_,i)=>`hidden-random:${i}`),styles:id.startsWith("twelve")?["active","conservative","competitive","random"]:["active"],recordRoot:await createTestTempDirectory("awa-hidden-random-"),maxDays:12});
 expect(report.games).toHaveLength(20);expect(report.rejects).toBe(0);expect(report.fallbacks).toBe(0);expect(report.naturallyFinished).toBe(20);expect(report.branches.hidden_wolf_awakened).toBeGreaterThan(0);let inheritedKnives=0,maskedOpenings=0;
 const root=await createTestTempDirectory("awa-hidden-random-replay-");
 for(const game of report.games){const record=await readReproduction(path.join(game.recordDir,"reproduction.json")),hidden=record.metadata.players.find(p=>p.role==="hidden_wolf")!.id;expect(record.checkpoints[0].players.find(p=>p.id===hidden)!.privateState.hidden_wolf).toEqual({hasInheritedKnife:false});maskedOpenings++;for(const e of record.events){if(e.type==="wolf_kill_vote_cast"&&e.payload.actorId===hidden)inheritedKnives++;if(["wolf_discussion","wolf_discussion_ended"].includes(e.type))expect(e.payload.actorId).not.toBe(hidden);}expect((await replayReproduction(record,root)).snapshot.result).toEqual(game.result);}
 expect(inheritedKnives).toBeGreaterThan(0);expect(maskedOpenings).toBe(20);
},30000);
