const WORKER_ORIGIN = "https://lol-match-dashboard-api.1693402463.workers.dev";

export async function onRequest(context) {
  const { request } = context;
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, WORKER_ORIGIN);

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", incomingUrl.host);
  headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  const resHeaders = new Headers(response.headers);
  resHeaders.delete("access-control-allow-origin");
  resHeaders.delete("access-control-allow-methods");
  resHeaders.delete("access-control-allow-headers");
  resHeaders.delete("access-control-max-age");
  resHeaders.delete("access-control-expose-headers");
  resHeaders.delete("vary");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
}
