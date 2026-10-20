/**
 * 负责监听主机与请求 Host 的对应关系；输入显式绑定地址和本机网卡，输出规范主机名、访问地址及有限白名单。
 * 通配监听只接受本机实际地址，不放开任意域名；这里只核对网络入口，不授予跨源写入权限或读取认证。
 */
import { isIP } from "node:net";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

export function normalizeListenHost(value: string): string {
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^\[([^\]]+)\]$/, "$1");
  if (!host || (!isIP(host) && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)))
    throw Error("workbench_host_invalid");
  // WHATWG URL 会将 IPv6 的展开、压缩和 IPv4 映射写法统一为同一地址。
  return isIP(host) === 6 ? new URL(`http://[${host}]/`).hostname.slice(1, -1) : host;
}

export function listenUrl(host: string, port: number): string {
  return `http://${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
}

export function workbenchRequestHosts(
  host: string,
  interfaces?: Record<string, NetworkInterfaceInfo[] | undefined>,
): ReadonlySet<string> {
  const normalized = normalizeListenHost(host);
  const allowed = new Set(["localhost", "127.0.0.1", "::1", normalized]);
  if (normalized === "0.0.0.0" || normalized === "::")
    for (const entries of Object.values(interfaces ?? networkInterfaces()))
      for (const entry of entries ?? []) allowed.add(normalizeListenHost(entry.address));
  return allowed;
}
