import type { Server } from "node:http";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { getMarketOverview, getOptionChain } from "./market-feed";
import { getTradingConfig } from "./trading-config-store";
import { portfolioFeed } from "./portfolio-feed";
import { refreshPaperQuotes } from "../routes/tradepro";

type Client = {
  socket: WebSocket;
  instruments: Set<string>;
  unsubscribe?: () => void;
};

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function parseInstruments(raw: RawData) {
  try {
    const value = JSON.parse(raw.toString()) as { instruments?: unknown };
    return Array.isArray(value.instruments)
      ? value.instruments.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function attachTradingWebSocket(server: Server) {
  const marketWss = new WebSocketServer({ noServer: true });
  const portfolioWss = new WebSocketServer({ noServer: true });
  const marketClients = new Set<WebSocket>();
  const portfolioClients = new Set<Client>();

  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const target = pathname === "/api/ws/market" ? marketWss : pathname === "/api/ws/portfolio" ? portfolioWss : undefined;
    if (!target) {
      socket.destroy();
      return;
    }
    target.handleUpgrade(request, socket, head, (client) => target.emit("connection", client, request));
  });

  marketWss.on("connection", (socket) => {
    marketClients.add(socket);
    const current = getTradingConfig();
    send(socket, {
      type: "snapshot",
      market: getMarketOverview(current.currencyRate),
      chain: getOptionChain(),
      currencySource: current.currencySource,
      currencyFetchedAt: current.currencyFetchedAt,
    });
    socket.on("close", () => marketClients.delete(socket));
  });

  portfolioWss.on("connection", (socket) => {
    const client: Client = { socket, instruments: new Set() };
    portfolioClients.add(client);
    client.unsubscribe = portfolioFeed.subscribe([], (tick) => {
      if (client.instruments.size === 0 || client.instruments.has(tick.instrument)) {
        send(socket, { type: "price", ...tick });
      }
    });
    send(socket, { type: "snapshot", prices: portfolioFeed.snapshot().prices });
    socket.on("message", (raw) => {
      const instruments = parseInstruments(raw);
      client.instruments = new Set(instruments);
      client.unsubscribe?.();
      client.unsubscribe = portfolioFeed.subscribe(instruments, (tick) => send(socket, { type: "price", ...tick }));
    });
    socket.on("close", () => {
      client.unsubscribe?.();
      portfolioClients.delete(client);
    });
  });

  const tickTimer = setInterval(() => {
    const config = getTradingConfig();
    const chain = getOptionChain();
    const overview = getMarketOverview(config.currencyRate);
    const settledPositions = refreshPaperQuotes(chain);
    marketClients.forEach((socket) => send(socket, { type: "tick", market: overview, chain }));
    const prices = chain.flatMap((row) => [
      { instrument: `BTC ${row.strike.toLocaleString("en-IN")} CE`, price: row.callLtp, timestamp: Date.now() },
      { instrument: `BTC ${row.strike.toLocaleString("en-IN")} PE`, price: row.putLtp, timestamp: Date.now() },
    ]);
    portfolioFeed.publishMany(prices);
    if (settledPositions.length > 0) {
      portfolioClients.forEach((client) => {
        send(client.socket, {
          type: "portfolio-update",
          reason: "bracket-triggered",
          positions: settledPositions.map((position) => ({
            id: position.id,
            instrument: position.instrument,
            status: position.status,
            price: position.livePrice,
          })),
        });
      });
    }
  }, 350);

  server.on("close", () => {
    clearInterval(tickTimer);
    marketWss.close();
    portfolioWss.close();
  });
}