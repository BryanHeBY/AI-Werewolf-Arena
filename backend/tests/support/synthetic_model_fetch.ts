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
