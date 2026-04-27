import { io, Socket } from "socket.io-client";
import { useGameStore } from "@/stores/gameStore";
import type {
  WebSocketEvent,
  GameStateUpdate,
  ChatMessage,
} from "@/types/v2-types";

/**
 * 游戏WebSocket连接管理类
 * 负责处理与游戏服务器的WebSocket连接、心跳、断线重连等
 */
export class GameSocket {
  private socket: Socket | null = null;
  private store: ReturnType<typeof useGameStore>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 1秒
  private maxReconnectDelay = 30000; // 30秒
  private pingInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval = 30000; // 30秒
  private heartbeatTimeout = 5000; // 5秒等待pong响应
  private lastPingTime = 0;
  private latency = 0;
  private connectionPromise: Promise<void> | null = null;
  private connectionPromiseResolve: (() => void) | null = null;
  private connectionPromiseReject: ((error: Error) => void) | null = null;

  constructor() {
    this.store = useGameStore();
  }

  /**
   * 连接到服务器
   * @param url 服务器地址，默认为 http://localhost:3344
   */
  connect(url: string = "http://localhost:3344"): Promise<void> {
    // 如果已经连接，先断开
    if (this.socket?.connected) {
      this.disconnect();
    }

    // 创建连接Promise
    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionPromiseResolve = resolve;
      this.connectionPromiseReject = reject;
    });

    console.log(`[GameSocket] 正在连接到服务器: ${url}`);

    this.socket = io(url, {
      transports: ["websocket", "polling"],
      reconnection: false, // 我们手动处理重连逻辑
      timeout: 10000, // 10秒连接超时
    });

    this.setupEventListeners();

    return this.connectionPromise;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log("[GameSocket] 断开连接");

    // 停止心跳
    this.stopHeartbeat();

    // 断开socket连接
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // 更新store状态
    this.store.updateConnectionStatus(false);

    // 重置重连计数器
    this.reconnectAttempts = 0;

    // 清理连接Promise
    if (this.connectionPromiseReject) {
      this.connectionPromiseReject(new Error("手动断开连接"));
      this.connectionPromise = null;
      this.connectionPromiseResolve = null;
      this.connectionPromiseReject = null;
    }
  }

  /**
   * 发送事件到服务器
   * @param event 要发送的事件
   */
  sendEvent(event: WebSocketEvent): void {
    if (!this.socket?.connected) {
      console.error("[GameSocket] 无法发送事件：socket未连接", event);
      return;
    }

    console.log(`[GameSocket] 发送事件: ${event.type}`, event);

    switch (event.type) {
      case "ping":
        this.socket.emit("ping");
        break;
      case "pong":
        this.socket.emit("pong");
        break;
      case "submitAction":
        this.socket.emit("submitAction", event.data);
        break;
      case "requestFullState":
        this.socket.emit("requestFullState");
        break;
      default:
        console.warn(`[GameSocket] 未知事件类型: ${event.type}`);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on("connect", this.handleConnect.bind(this));

    // 连接错误
    this.socket.on("connect_error", this.handleConnectError.bind(this));

    // 断开连接
    this.socket.on("disconnect", this.handleDisconnect.bind(this));

    // 服务器事件
    this.socket.on("gameStateUpdate", this.handleGameStateUpdate.bind(this));
    this.socket.on("chatMessage", this.handleChatMessage.bind(this));
    this.socket.on("pong", this.handlePong.bind(this));
  }

  /**
   * 处理连接成功
   */
  private handleConnect(): void {
    console.log("[GameSocket] 连接成功");

    // 更新store状态
    this.store.updateConnectionStatus(true);

    // 重置重连计数器
    this.reconnectAttempts = 0;

    // 开始心跳
    this.startHeartbeat();

    // 解析连接Promise
    if (this.connectionPromiseResolve) {
      this.connectionPromiseResolve();
      this.connectionPromise = null;
      this.connectionPromiseResolve = null;
      this.connectionPromiseReject = null;
    }
  }

  /**
   * 处理连接错误
   * @param error 错误信息
   */
  private handleConnectError(error: Error): void {
    console.error("[GameSocket] 连接错误:", error.message);

    // 拒绝连接Promise
    if (this.connectionPromiseReject) {
      this.connectionPromiseReject(error);
      this.connectionPromise = null;
      this.connectionPromiseResolve = null;
      this.connectionPromiseReject = null;
    }

    // 尝试重连
    this.handleReconnect();
  }

  /**
   * 处理断开连接
   * @param reason 断开原因
   */
  private handleDisconnect(reason: string): void {
    console.log(`[GameSocket] 断开连接: ${reason}`);

    // 更新store状态
    this.store.updateConnectionStatus(false);

    // 停止心跳
    this.stopHeartbeat();

    // 如果不是手动断开，尝试重连
    if (reason !== "io client disconnect") {
      this.handleReconnect();
    }
  }

  /**
   * 处理游戏状态更新
   * @param data 游戏状态数据
   */
  private handleGameStateUpdate(data: GameStateUpdate): void {
    console.log("[GameSocket] 收到游戏状态更新");
    this.store.updateGameState(data);
  }

  /**
   * 处理聊天消息
   * @param data 聊天消息数据
   */
  private handleChatMessage(data: ChatMessage): void {
    console.log("[GameSocket] 收到聊天消息");
    this.store.addChatMessage(data);
  }

  /**
   * 处理pong响应
   */
  private handlePong(): void {
    if (this.lastPingTime > 0) {
      this.latency = Date.now() - this.lastPingTime;
      console.log(`[GameSocket] 收到pong，延迟: ${this.latency}ms`);
    }

    // 清除ping超时
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  /**
   * 开始心跳机制
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 先停止现有的心跳

    console.log("[GameSocket] 开始心跳机制");

    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.heartbeatInterval);

    // 立即发送第一个ping
    setTimeout(() => this.sendPing(), 1000);
  }

  /**
   * 停止心跳机制
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  /**
   * 发送ping
   */
  private sendPing(): void {
    if (!this.socket?.connected) {
      return;
    }

    this.lastPingTime = Date.now();
    this.socket.emit("ping");

    console.log("[GameSocket] 发送ping");

    // 设置ping超时
    this.pingTimeout = setTimeout(() => {
      console.warn("[GameSocket] ping超时，可能连接断开");
      // 如果ping超时，认为连接有问题，尝试重连
      if (this.socket?.connected) {
        this.socket.disconnect();
      }
    }, this.heartbeatTimeout);
  }

  /**
   * 处理重连逻辑
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[GameSocket] 达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`,
      );
      return;
    }

    this.reconnectAttempts++;

    // 指数退避策略计算延迟
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    console.log(
      `[GameSocket] ${delay}ms后尝试重连 (第${this.reconnectAttempts}次)`,
    );

    setTimeout(() => {
      if (this.socket && !this.socket.connected) {
        console.log(`[GameSocket] 正在重连...`);
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 获取当前延迟
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * 获取重连尝试次数
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// 创建单例实例
let gameSocketInstance: GameSocket | null = null;

/**
 * 获取GameSocket单例实例
 */
export function getGameSocket(): GameSocket {
  if (!gameSocketInstance) {
    gameSocketInstance = new GameSocket();
  }
  return gameSocketInstance;
}
