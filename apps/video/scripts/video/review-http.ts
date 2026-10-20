/** 负责本机审片文件服务。输入为显式文件映射，输出GET/HEAD及Range响应；路径由调用方列出，不开放目录。 */
import path from "node:path";
export function serveLocalReview(options: {
  root: string;
  port: number;
  resolve: (pathname: string) => Promise<string | Response | undefined>;
}) {
  const root = path.resolve(options.root);
  return Bun.serve({
    hostname: "127.0.0.1",
    port: options.port,
    async fetch(request) {
      if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
      const target = await options.resolve(new URL(request.url).pathname);
      if (target instanceof Response) return target;
      if (!target || !path.resolve(target).startsWith(root + path.sep))
        return new Response("Not found", { status: 404 });
      const file = Bun.file(target);
      if (!(await file.exists())) return new Response("Preparing", { status: 404 });
      const headers = new Headers({
        "Content-Type": file.type,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      const range = request.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        let from = match?.[1] ? Number(match[1]) : 0,
          to = match?.[2] ? Number(match[2]) : file.size - 1;
        if (match && !match[1] && match[2]) {
          from = Math.max(0, file.size - Number(match[2]));
          to = file.size - 1;
        }
        if (
          !match ||
          (!match[1] && !match[2]) ||
          !Number.isSafeInteger(from) ||
          !Number.isSafeInteger(to) ||
          from < 0 ||
          from > to ||
          from >= file.size
        )
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${file.size}` },
          });
        to = Math.min(to, file.size - 1);
        headers.set("Content-Range", `bytes ${from}-${to}/${file.size}`);
        headers.set("Content-Length", String(to - from + 1));
        return new Response(request.method === "HEAD" ? null : file.slice(from, to + 1), {
          status: 206,
          headers,
        });
      }
      headers.set("Content-Length", String(file.size));
      return new Response(request.method === "HEAD" ? null : file, { headers });
    },
  });
}
