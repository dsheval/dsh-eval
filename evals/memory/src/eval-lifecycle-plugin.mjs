import { createServer } from "node:http";

export const name = "memory-eval-lifecycle";

function loopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export async function apply(ctx) {
  const port = Number(process.env.DSH_EVAL_CONTROL_PORT);
  const token = process.env.DSH_EVAL_CONTROL_TOKEN;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535 || !token) {
    throw new Error("memory-eval lifecycle control requires a valid port and token");
  }

  let closing = false;
  const server = createServer((request, response) => {
    const authorized = request.headers.authorization === `Bearer ${token}`;
    if (!loopback(request.socket.remoteAddress) || request.method !== "POST" || request.url !== "/shutdown" || !authorized) {
      response.writeHead(404, { connection: "close" });
      response.end();
      return;
    }
    if (closing) {
      response.writeHead(409, { connection: "close" });
      response.end();
      return;
    }
    closing = true;
    response.writeHead(202, { "content-type": "application/json", connection: "close" });
    response.end('{"accepted":true}\n');
    setTimeout(() => process.emit("SIGTERM"), 25);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  ctx.effect(
    () => () => new Promise((resolve) => server.close(() => resolve())),
    "memory-eval-lifecycle.control",
  );
}
