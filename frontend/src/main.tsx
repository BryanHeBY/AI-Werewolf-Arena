/**
 * 负责浏览器 React 根节点装配。输入为宿主页面的 app 元素，输出 StrictMode 下的复盘应用并加载样式。
 * 本入口不读取归档或保存播放状态，加载与效果清理由实际组件负责。
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
