# P7 浏览器测试服务就绪检查

首次46项E2E有45过/1失败；既有no-winner用例在5秒内未找到结果文本。原日志`/tmp/awa-p7-psychic-e2e.log`及同预算定向失败`/tmp/awa-p7-psychic-e2e-no-winner.log`保留，snapshot分别停在加载态/已出现正确无胜者文本。

独立本地诊断里API响应约283ms完成，首次DOM可用约5.4秒，其后约0.3秒；L/D两套全新Vite缓存探针中HTML/入口检查均过，未复现原超时，故不声称根因是API慢、HMR或冷transform。这里只把test服务健康检查从HTML改为转换的`/src/main.tsx`，更明确等待入口可用；断言、5秒expect预算与120秒webServer预算均不改，不改变产品加载逻辑。

改变后原no-winner定向1项通过（`/tmp/awa-p7-psychic-e2e-ready-entry.log`），最终所有**46实际Chromium案例通过、exit0**（`/tmp/awa-p7-psychic-e2e-final.log`）。L/D只读认可范围和两PNG目检，无生产源码修改；本笔仅testinfra和证据，通灵角色另笔提交。未接触认证/用户配置。
