/**
 * 负责向放逐流水线公开动物单元建设与已接受票提交的实际绑定。
 * 输入由调用方在原接收／封票时点传入；导出原 authority 开单元与同族接受票 owner 的函数，不追加复验或包装。
 * 原 World／token／当前性检查及失败停止仍由 authority 执行；公开函数不替代许可或付款。
 */
export { beginAnimalExileUnit } from "./authority";
export { recordAnimalBallotRound, sealAnimalBallots } from "./accepted-ballots";
