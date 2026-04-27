// 导入Vue响应式API和生命周期钩子
import { ref, onUnmounted } from "vue";
// 导入Socket.IO客户端库和类型定义
import { io, type Socket } from "socket.io-client";
// 导入游戏广播事件类型定义
// import type { BroadcastEvent } from "@/types";

/**
 * WebSocket连接管理的组合式函数
 * 提供与后端游戏服务器的实时WebSocket通信功能
 *
 * @param url - WebSocket服务器URL，默认为"http://localhost:3344"
 * @returns WebSocket连接管理对象，包含连接状态、方法和响应式引用
 */
export function useWebSocket(url: string = "http://localhost:3344") {
  // 响应式引用：Socket.IO客户端实例
  const socket = ref<Socket | null>(null);
  // 响应式引用：连接状态，表示是否已成功连接到服务器
  const isConnected = ref(false);
  // 响应式引用：错误信息，存储连接或通信过程中发生的错误
  const error = ref<string | null>(null);

  /**
   * 连接到WebSocket服务器
   * 初始化Socket.IO连接，设置事件监听器
   * 处理连接成功、断开连接、连接错误等事件
   */
  const connect = () => {
    try {
      // 创建Socket.IO客户端实例
      socket.value = io(url, {
        transports: ["websocket", "polling"], // 传输方式优先WebSocket，降级到轮询
        reconnection: true, // 启用自动重连
        reconnectionAttempts: 5, // 最大重连尝试次数
        reconnectionDelay: 1000, // 重连延迟时间（毫秒）
      });

      // 监听连接成功事件
      socket.value.on("connect", () => {
        console.log("[WebSocket] Connected to", url); // 连接成功日志
        isConnected.value = true; // 更新连接状态为已连接
        error.value = null; // 清除之前的错误信息
      });

      // 监听断开连接事件
      socket.value.on("disconnect", () => {
        console.log("[WebSocket] Disconnected"); // 断开连接日志
        isConnected.value = false; // 更新连接状态为已断开
      });

      // 监听连接错误事件
      socket.value.on("connect_error", (err) => {
        console.error("[WebSocket] Connection error:", err); // 连接错误日志
        error.value = err.message; // 存储错误信息
        isConnected.value = false; // 更新连接状态为已断开
      });

      // 监听一般错误事件
      socket.value.on("error", (err) => {
        console.error("[WebSocket] Error:", err); // 错误日志
        // 将错误转换为字符串形式存储
        error.value = err instanceof Error ? err.message : String(err);
      });
    } catch (err) {
      // 捕获初始化过程中的异常（如URL无效等）
      console.error("[WebSocket] Failed to initialize:", err); // 初始化失败日志
      error.value = err instanceof Error ? err.message : String(err); // 存储错误信息
    }
  };

  /**
   * 断开WebSocket连接
   * 关闭Socket.IO连接并清理资源
   */
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect(); // 断开连接
      socket.value = null; // 清空Socket实例引用
      isConnected.value = false; // 更新连接状态为已断开
    }
  };

  /**
   * 注册事件监听器
   * 监听服务器发送的特定事件
   *
   * @param event - 事件名称
   * @param callback - 事件回调函数
   */
  const on = (event: string, callback: (data: any) => void) => {
    socket.value?.on(event, callback); // 注册事件监听器，如果socket存在的话
  };

  /**
   * 移除事件监听器
   * 可以移除特定回调函数，或移除该事件的所有监听器
   *
   * @param event - 事件名称
   * @param callback - 可选，要移除的特定回调函数
   */
  const off = (event: string, callback?: (data: any) => void) => {
    if (callback) {
      // 移除特定回调函数的监听器
      socket.value?.off(event, callback);
    } else {
      // 移除该事件的所有监听器
      socket.value?.off(event);
    }
  };

  /**
   * 发送事件到服务器
   * 向服务器发送自定义事件和数据
   *
   * @param event - 事件名称
   * @param args - 要发送的数据参数
   */
  const emit = (event: string, ...args: any[]) => {
    socket.value?.emit(event, ...args); // 发送事件，如果socket存在的话
  };

  /**
   * 组件卸载时的清理钩子
   * 确保组件卸载时断开WebSocket连接，避免内存泄漏
   */
  onUnmounted(() => {
    disconnect(); // 组件卸载时断开连接
  });

  /**
   * 返回WebSocket连接管理对象
   * 包含所有状态和方法，供组件使用
   */
  return {
    socket, // Socket.IO实例的响应式引用
    isConnected, // 连接状态的响应式引用
    error, // 错误信息的响应式引用
    connect, // 连接方法
    disconnect, // 断开连接方法
    on, // 注册事件监听器方法
    off, // 移除事件监听器方法
    emit, // 发送事件方法
  };
}
