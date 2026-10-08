import { expect, test } from "bun:test";
import { recordedErrorName } from "../../src/recording/reproduction";

test("recorded error names preserve the existing six machine names with controlled native reads", () => {
  for (const [error, name] of [[new Error(), "Error"], [new TypeError(), "TypeError"], [new RangeError(), "RangeError"], [new AggregateError([]), "AggregateError"], [new DOMException("", "AbortError"), "AbortError"], [new DOMException("", "TimeoutError"), "TimeoutError"]] as const) expect(recordedErrorName(error)).toBe(name);
  expect(recordedErrorName(Object.assign(new Error(), { name: "AbortError" }))).toBe("AbortError");
  expect(recordedErrorName(Object.assign(new Error(), { name: "PRIVATE_NAME_CANARY" }))).toBe("Error");
  expect(recordedErrorName(new DOMException("", "PRIVATE_NAME_CANARY"))).toBe("Error");
});

test("changing and throwing name getters never execute or replace the original error", () => {
  let reads = 0;
  const changing = new TypeError("original");
  Object.defineProperty(changing, "name", { get() { reads++; return reads === 1 ? "TypeError" : "PRIVATE_RECORDED_NAME_CANARY"; } });
  expect(recordedErrorName(changing)).toBe("Error"); expect(reads).toBe(0);
  const throwing = new Error("original");
  Object.defineProperty(throwing, "name", { get() { reads++; throw new Error("getter-must-not-run"); } });
  expect(recordedErrorName(throwing)).toBe("Error"); expect(reads).toBe(0);
  const inherited = new Error("original");
  Object.setPrototypeOf(inherited, Object.create(Error.prototype, { name: { get() { reads++; return "PRIVATE_INHERITED_NAME"; } } }));
  expect(recordedErrorName(inherited)).toBe("Error"); expect(reads).toBe(0);
});

test("proxy errors and proxy prototypes are not consulted for recording", () => {
  let traps = 0;
  const handler = { get() { traps++; throw new Error("get-trap"); }, getPrototypeOf() { traps++; throw new Error("proto-trap"); }, getOwnPropertyDescriptor() { traps++; throw new Error("descriptor-trap"); } };
  expect(recordedErrorName(new Proxy(new Error("original"), handler))).toBe("Error"); expect(traps).toBe(0);
  const native = new Error("original"); Object.setPrototypeOf(native, new Proxy(Error.prototype, handler));
  expect(recordedErrorName(native)).toBe("Error"); expect(traps).toBe(0);
  expect(recordedErrorName({ get name() { traps++; throw new Error("plain-getter"); } })).toBe("Error"); expect(traps).toBe(0);
});
