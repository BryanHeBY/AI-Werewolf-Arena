import {expect,test} from "bun:test";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {loadBoardDefinition} from "../../src/runtime/config/load_board_definition";
import {parseBoardDefinition} from "../../src/runtime/config/board_definition";
import {parseRuntimeConfig} from "../../src/runtime/config/parse_config";
import {resolveGameSetup} from "../../src/runtime/config/resolve_game_setup";
for(const [id,size] of [["six_player_gravekeeper",6],["twelve_player_gravekeeper",12]] as const)test(`${id}: public examples resolve the passive profile and reject invented variants or unregistered roles`,async()=>{
 const root=path.resolve(import.meta.dir,"../../../configs.example"),board=await loadBoardDefinition(root,id),game=JSON.parse(await readFile(path.join(root,`games/${id}.json`),"utf8"));
 const runtime=parseRuntimeConfig({providers:{default:"synthetic",items:{synthetic:{type:"openai",apiKey:"synthetic-only",baseURL:"http://127.0.0.1/v1"}}},agents:{default:"deepseek_v4_flash",items:{deepseek_v4_flash:{kind:"llm",provider:"synthetic",model:"synthetic"}}},game});
 expect(resolveGameSetup(runtime,{},board).boardConfig.boardSize).toBe(size);expect(game.printPrivateEvents).toBe(false);
 expect(board.config.roleSetups.find(row=>row.role==="gravekeeper")).toEqual({role:"gravekeeper",count:1});
 for(const parameters of [{activeCheck:true},{repeatLatest:true},{revealRole:true}])expect(()=>parseBoardDefinition({...board.definition,roles:{...board.definition.roles,gravekeeper:parameters}})).toThrow(`board_config_invalid_field: roles.gravekeeper.${Object.keys(parameters)[0]}`);
 const planned=structuredClone(board.definition);planned.board.roleSetups[0].role="dreamer";expect(()=>parseBoardDefinition(planned)).toThrow("board_config_role_not_implemented");
});
