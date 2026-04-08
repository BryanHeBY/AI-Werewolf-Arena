import { ref, onUnmounted } from "vue";
import { io, type Socket } from "socket.io-client";
export function useWebSocket(url: string = "http://localhost:3344") {
  const socket = ref<Socket | null>(null);
  const isConnected = ref(false);
  const error = ref<string | null>(null);

  const connect = () => {
    try {
      socket.value = io(url, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.value.on("connect", () => {
        console.log("[WebSocket] Connected to", url);
        isConnected.value = true;
        error.value = null;
      });

      socket.value.on("disconnect", () => {
        console.log("[WebSocket] Disconnected");
        isConnected.value = false;
      });

      socket.value.on("connect_error", (err) => {
        console.error("[WebSocket] Connection error:", err);
        error.value = err.message;
        isConnected.value = false;
      });

      socket.value.on("error", (err) => {
        console.error("[WebSocket] Error:", err);
        error.value = err instanceof Error ? err.message : String(err);
      });
    } catch (err) {
      console.error("[WebSocket] Failed to initialize:", err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  };

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
      isConnected.value = false;
    }
  };

  const on = <T = unknown>(event: string, callback: (data: T) => void) => {
    socket.value?.on(event, callback);
  };

  const off = <T = unknown>(event: string, callback?: (data: T) => void) => {
    if (callback) {
      socket.value?.off(event, callback);
    } else {
      socket.value?.off(event);
    }
  };

  const emit = (event: string, ...args: unknown[]) => {
    socket.value?.emit(event, ...args);
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    socket,
    isConnected,
    error,
    connect,
    disconnect,
    on,
    off,
    emit,
  };
}
