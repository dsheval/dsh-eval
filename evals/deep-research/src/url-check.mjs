import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { safeError } from "./lib.mjs";

export async function checkUrls(urls, options = {}) {
  const limit = options.limit ?? 20;
  const unique = [...new Set(urls)].slice(0, limit);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8));
  const results = new Array(unique.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await checkUrl(unique[index], options);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function checkUrl(url, options = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  try {
    let current = new URL(url);
    for (let redirects = 0; redirects <= (options.maxRedirects ?? 3); redirects += 1) {
      await assertPublicHttpUrl(current, resolveHost);
      let response = await request(fetchImpl, current, "HEAD", options);
      if (response.status === 405 || response.status === 501) {
        response = await request(fetchImpl, current, "GET", options);
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return result(url, current.href, false, response.status, "redirect without location");
        current = new URL(location, current);
        continue;
      }
      return result(url, current.href, response.ok, response.status, response.ok ? null : `HTTP ${response.status}`);
    }
    return result(url, current.href, false, null, "too many redirects");
  } catch (error) {
    return result(url, null, false, null, safeError(error));
  }
}

async function request(fetchImpl, url, method, options) {
  const headers = { "user-agent": "dsh-research-eval/1.0" };
  if (method === "GET") headers.range = "bytes=0-32767";
  return await fetchImpl(url, {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
  });
}

async function assertPublicHttpUrl(url, resolveHost) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`unsupported protocol: ${url.protocol}`);
  }
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("loopback URL blocked");
  const addresses = isIP(host) ? [host] : await resolveHost(host);
  if (!addresses.length) throw new Error("hostname did not resolve");
  if (addresses.some(isPrivateAddress)) throw new Error("private or local address blocked");
}

async function defaultResolveHost(host) {
  const rows = await lookup(host, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

function isPrivateAddress(address) {
  if (address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd")) return true;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const value = mapped ?? address;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function result(url, finalUrl, open, status, error) {
  return { url, finalUrl, open, status, error };
}
