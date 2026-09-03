import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketOverview, OptionChainRow } from "@workspace/api-client-react";

type MarketStreamMessage =
  | { type: "snapshot" | "tick"; market: MarketOverview; chain: OptionChainRow[]; currencySource?: "live" | "fallback"; currencyFetchedAt?: string };

export type MarketLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

function endpoint() {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/market`;
}

export function useMarketLive(initialMarket: MarketOverview, initialChain: OptionChainRow[]) {
  const [market, setMarket] = useState(initialMarket);
  const [chain, setChain] = useState(initialChain);
  const [status, setStatus] = useState<MarketLiveStatus>("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number>();
  const [attempt, setAttempt] = useState(0);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const generationRef = useRef(0);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const url = useMemo(endpoint, []);

  useEffect(() => {
    if (!url) {
      setStatus("offline");
      return;
    }
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      const generation = ++generationRef.current;
      setStatus(attemptRef.current > 0 ? "reconnecting" : "connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed || generation !== generationRef.current) return;
        setStatus("live");
        attemptRef.current = 0;
        setAttempt(0);
      };
      socket.onmessage = (event) => {
        if (disposed || generation !== generationRef.current) return;
        try {
          const message = JSON.parse(String(event.data)) as MarketStreamMessage;
          if (message.market && Array.isArray(message.chain)) {
            setMarket(message.market);
            setChain(message.chain);
            setLastMessageAt(Date.now());
          }
        } catch {
          // Ignore malformed stream frames; the connection remains usable.
        }
      };
      socket.onerror = () => {
        if (!disposed && generation === generationRef.current) setStatus("reconnecting");
      };
      socket.onclose = () => {
        if (disposed || generation !== generationRef.current) return;
        const nextAttempt = attemptRef.current + 1;
        attemptRef.current = nextAttempt;
        setAttempt(nextAttempt);
        setStatus("reconnecting");
        timerRef.current = window.setTimeout(connect, Math.min(30_000, 500 * 2 ** Math.min(nextAttempt - 1, 6)));
      };
    };
    connect();
    return () => {
      disposed = true;
      generationRef.current += 1;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [url]);

  useEffect(() => {
    setMarket(initialMarket);
  }, [initialMarket]);

  useEffect(() => {
    setChain(initialChain);
  }, [initialChain]);

  return {
    market,
    chain,
    status,
    lastMessageAt,
    isLive: status === "live" && !!lastMessageAt && Date.now() - lastMessageAt < 2_000,
  };
}