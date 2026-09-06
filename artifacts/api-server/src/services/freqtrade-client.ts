import fetch from "node-fetch";

type LoginResponse = { access_token?: string } | { token?: string } | any;

async function tryJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function loginWithJwt(baseUrl: string, username: string, password: string, timeout = 3000) {
  if (!baseUrl || !username || !password) throw new Error("freqtrade login not configured");
  const attemptPaths = ["/api/v1/auth/login", "/api/v1/login", "/login"];
  for (const p of attemptPaths) {
    const url = baseUrl.replace(/\/+$/,'') + p;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const parsed: LoginResponse = await tryJson(res as unknown as Response);
      // prefer access_token or token fields (freqtrade/kinda varies)
      return (parsed && (parsed.access_token ?? parsed.token ?? parsed.jwt)) || null;
    } catch (err) {
      // try next path
      // eslint-disable-next-line no-console
      console.debug(`freqtrade login attempt ${url} failed:`, (err as Error).message);
    }
  }
  throw new Error("freqtrade login failed");
}

export async function getBotStatus(baseUrl: string, token: string | null, timeout = 3000) {
  const paths = ["/api/v1/bot/status", "/api/v1/status", "/api/v1/bot"];
  for (const p of paths) {
    const url = baseUrl.replace(/\/+$/,'') + p;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await tryJson(res as unknown as Response);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug(`freqtrade status attempt ${url} failed:`, (err as Error).message);
    }
  }
  throw new Error("freqtrade status fetch failed");
}

export async function sendBotControl(baseUrl: string, token: string | null, action: any, timeout = 3000) {
  const paths = ["/api/v1/bot/control", "/api/v1/control", "/api/v1/bot/actions"];
  for (const p of paths) {
    const url = baseUrl.replace(/\/+$/,'') + p;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
        body: JSON.stringify(action),
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      return await tryJson(res as unknown as Response);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug(`freqtrade control attempt ${url} failed:`, (err as Error).message);
    }
  }
  throw new Error("freqtrade control request failed");
}
