/**
 * 浏览器测试支持层负责定位当前事件保留的原文。输入为页面，输出可重试的原文定位器。
 * 结构化事件会把原文放进折叠公告，本层只核对来源内容，不将隐藏文本当作可见性证据；
 * 折叠、展开和结构化内容的可见性由 video-readability 浏览器用例单独验证。
 */
import type { Page } from "@playwright/test";

export function currentEventSourceText(page: Page) {
  return page.locator(".current-event p[aria-label]");
}
