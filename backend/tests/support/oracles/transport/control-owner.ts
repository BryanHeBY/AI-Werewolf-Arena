/**
 * Owns the original literal test oracle closure oracle for control-owner HTTP probes.
 * Inputs are observed status/body or transport errors and existing finish/fail
 * callbacks; outputs retain closed/different-owner classifications and errors.
 * No network, timer, process, token or gameplay authority is allocated here;
 * the driver retains its original parsing catch, request and cleanup ordering.
 */
export function classifyControlResponse(response: { readonly statusCode?: number }, body: any, finish: (value: "closed" | "reused_by_different_owner") => void, fail: (error: Error) => void): void {
if (response.statusCode === 401 && body?.ok === false && body?.error === "unauthorized")
            finish("reused_by_different_owner");
          else
            fail(
              new Error(`fixture_control_owner_still_reachable_or_unknown_${response.statusCode}`),
            );
}

export function classifyControlRequestError(error: NodeJS.ErrnoException, finish: (value: "closed" | "reused_by_different_owner") => void, fail: (error: Error) => void): void {
if (error.code === "ECONNREFUSED") finish("closed");
    else fail(new Error(`fixture_control_probe_request_error_${error.code ?? "unknown"}`));
}
