/** ACP session 可注入 MCP sidecar 的传输无关描述。 */
export interface AcpMcpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Array<{ name: string; value: string }>;
}

export interface AcpMcpControlServer {
  start(command: string, args: string[]): Promise<AcpMcpServerConfig>;
  bindSession(sessionId: string): void;
  close(options?: { force?: boolean }): Promise<void>;
}

/** 将领域注册表映射为一个只属于当前 ACP session 的 MCP server。 */
export interface AcpMcpBridgeFactory<TRegistry> {
  serverName: string;
  createControl(registry: TRegistry): AcpMcpControlServer;
  serverEntrypoint(currentFilename: string): string;
}
