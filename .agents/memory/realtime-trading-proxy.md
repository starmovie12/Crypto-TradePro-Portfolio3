---
name: Realtime trading proxy
description: Routing and settlement constraints for this realtime paper-trading app
---

The paper-trading WebSocket feed and server-side bracket settlement must share the same market tick loop. WebSocket routes also need explicit proxy allowlisting in the API and web artifact manifests; a REST route can work while an unlisted WebSocket handshake silently times out.

**Why:** The original implementation updated displayed prices but only evaluated target/stop exits during REST requests, and the first proxy configuration allowed REST traffic without forwarding the socket paths.

**How to apply:** When changing market-feed or artifact routing, verify both `/api/ws/market` and `/api/ws/portfolio` through the proxied preview, not only direct localhost REST requests.