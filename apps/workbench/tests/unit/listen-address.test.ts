/**
 * 负责监听地址的纯边界测试；输入字面 IPv4／IPv6、域名及网卡，输出规范地址和有限请求白名单。
 * 预期不从当前机器网络推导，通配地址不能使无关域名绕过 Host 校验。
 */
import { expect, test } from "bun:test";
import {
  normalizeListenHost,
  listenUrl,
  workbenchRequestHosts,
} from "../../src/server/listen-address";

test("host values and IPv6 URLs normalize without accepting a URL or port as a hostname", () => {
  expect(normalizeListenHost(" AWA.Example ")).toBe("awa.example");
  expect(normalizeListenHost("[::1]")).toBe("::1");
  expect(listenUrl("::1", 4311)).toBe("http://[::1]:4311");
  expect(listenUrl("0.0.0.0", 4311)).toBe("http://0.0.0.0:4311");
  for (const invalid of ["", "http://localhost", "localhost:4311", "../socket", "--port"])
    expect(() => normalizeListenHost(invalid)).toThrow("workbench_host_invalid");
});

test("wildcard request hosts are restricted to explicit local interface addresses and loopback aliases", () => {
  const interfaces = {
    lan: [
      {
        address: "192.0.2.40",
        family: "IPv4" as const,
        internal: false,
        netmask: "255.255.255.0",
        cidr: "192.0.2.40/24",
        mac: "00:00:00:00:00:00",
      },
    ],
  };
  const wildcard = workbenchRequestHosts("0.0.0.0", interfaces);
  expect(wildcard.has("192.0.2.40")).toBe(true);
  expect(wildcard.has("localhost")).toBe(true);
  expect(wildcard.has("::1")).toBe(true);
  expect(wildcard.has("unrelated.invalid")).toBe(false);
  expect(workbenchRequestHosts("127.0.0.1", interfaces).has("192.0.2.40")).toBe(false);
});
