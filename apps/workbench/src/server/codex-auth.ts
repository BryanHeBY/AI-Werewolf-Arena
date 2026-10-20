/**
 * 负责读取用户明确导入的本机 Codex 订阅文件；输入固定认证路径，输出 Pi OAuth 数据或不含正文的诊断。
 * 调用方只把返回值写入已有后端配置，HTTP 响应不得转发令牌；默认不读取整个 Codex home。
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WorkbenchError } from "./config-documents";

export async function readCodexSubscription(file = path.join(os.homedir(), ".codex/auth.json")) {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new WorkbenchError("codex_auth_missing", 409);
    throw new WorkbenchError("codex_auth_unreadable", 409);
  }
  let auth;
  try {
    auth = JSON.parse(text);
  } catch {
    throw new WorkbenchError("codex_auth_invalid", 409);
  }
  const tokens = auth?.tokens;
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.refresh_token !== "string" ||
    !tokens.refresh_token
  )
    throw new WorkbenchError("codex_auth_unavailable", 409);
  let expires = Date.now();
  try {
    const claims = JSON.parse(
      Buffer.from(tokens.access_token.split(".")[1], "base64url").toString(),
    );
    if (typeof claims.exp === "number" && Number.isFinite(claims.exp)) expires = claims.exp * 1000;
  } catch {
    /* 过期信息缺失时让 SDK 正常刷新，不猜测订阅凭据内容。 */
  }
  return {
    type: "oauth" as const,
    access: tokens.access_token as string,
    refresh: tokens.refresh_token as string,
    expires,
    ...(typeof tokens.account_id === "string" ? { accountId: tokens.account_id } : {}),
  };
}
