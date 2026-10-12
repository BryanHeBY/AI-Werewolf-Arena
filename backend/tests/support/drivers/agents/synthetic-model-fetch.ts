/**
 * Owns test driver support: Test-owned synthetic model token and authenticated fetch handler with original authentication-before-payload order.
 * Inputs are supplied script steps, callbacks or fixture resource requests;
 * outputs are the original controlled traces, handles and boundary responses.
 * Unit and scenario tests keep their supplied literal actions and failure
 * expectations as the oracle. Driver ownership, cleanup and error policy never
 * change during this relocation; no billed model is introduced.
 */
/** Each game owns its fixture token independently of released loopback ports. */
export function syntheticModelToken(): string {
  return `synthetic-${crypto.randomUUID()}`;
}

export function authenticatedSyntheticModelFetch(
  token: string,
  handler: (request: Request) => Response | Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    // Authentication precedes URL and JSON parsing: an old control-owner probe may
    // reach this port after its original server has closed.
    if (request.headers.get("authorization") !== `Bearer ${token}`)
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    return handler(request);
  };
}
