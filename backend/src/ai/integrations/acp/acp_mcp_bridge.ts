/**
 * 负责 ACP 可注入 MCP sidecar 的启动描述、控制生命周期和工厂类型声明。输入为原命令、
 * 可写参数／环境数组与 registry，输出配置形状和原 start／bindSession／close 运行端口。
 * 类型自身不创建进程、监听器或 token；副作用由实际 control／AcpProcessClient 实现拥有。
 * 请求期限、取消与会话回收仍归具体运行所有者，关闭失败或 force 行为不由此声明保证。
 * 配置不是领域许可、沙箱或认证新策略，本模块不复制、冻结数组或执行工具。
 */
export interface AcpMcpServerConfig {
  name: string;
  command: string;
  /** 原参数数组形状保持；具体 start 可保原引用，此声明不承诺拷贝或隔离。 */
  args: string[];
  /** 原按 name/value 传递的环境数组，实际 endpoint／token 仍由控制实现产生，不在此认证。 */
  env: Array<{ name: string; value: string }>;
}

/** 控制实现的原运行方法；只声明调用，不创建计时器、自动去重关闭或把完成类型当回收事实。 */
export interface AcpMcpControlServer {
  /** 由实际实现开启原控制面并返回 sidecar 配置；启动期限与失败清理由会话创建 owner 处理。 */
  start(command: string, args: string[]): Promise<AcpMcpServerConfig>;
  /** 交出原 sessionId 绑定指令；具体实现仍复验关闭／重复绑定，字符串本身不授权行动。 */
  bindSession(sessionId: string): void;
  /** 原可选 force 指令；具体关闭顺序、失败传播和有界强制回收仍由 control／session 生命周期执行。 */
  close(options?: { force?: boolean }): Promise<void>;
}

/** 原 registry 与会话控制的工厂接口；游戏／审计 bridge 提供各自实现，不增加另一 registry 或许可表。 */
export interface AcpMcpBridgeFactory<TRegistry> {
  serverName: string;
  /** 调用具体 factory 才构造原 control；原 registry 引用、方法 receiver 和副作用保持调用方实现。 */
  createControl(registry: TRegistry): AcpMcpControlServer;
  /** 由实际 factory 在原位置解析入口（默认保原 .ts/.js 选择）；不是在此执行入口文件。 */
  serverEntrypoint(currentFilename: string): string;
}
