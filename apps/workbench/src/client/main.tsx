/** 负责浏览器 React 根装配；输入宿主 app 节点，输出工作台应用。只加载样式，不读取配置或创建对局。 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@ai-werewolf-arena/game-media/style.css";
import "./style.css";
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
