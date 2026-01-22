import { serve } from "bun";
import { Socket } from "net";

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  games: string;
  region: string;
}

interface ServerResult extends Server {
  ping: number | null;
  status: "online" | "offline" | "error";
}

interface CachedResults {
  servers: ServerResult[];
  lastUpdate: string | null;
  internetSpeed: string;
}

// Server endpoints for TCP ping measurement
// Using hosts that accept TCP connections for accurate RTT measurement
const SERVERS: Server[] = [
  {
    id: "riot-tr",
    name: "Riot Games TR",
    host: "radore.com", // Turkish datacenter - close to Riot TR servers
    port: 443,
    games: "Valorant, LoL",
    region: "İstanbul (TR)",
  },
  {
    id: "faceit-eu",
    name: "Faceit EU",
    host: "dynamodb.eu-central-1.amazonaws.com",
    port: 443,
    games: "CS2 Turnuva",
    region: "Frankfurt (EU)",
  },
  {
    id: "steam-eu",
    name: "Steam EU",
    host: "dynamodb.eu-central-1.amazonaws.com",
    port: 443,
    games: "CS2, Dota 2",
    region: "Frankfurt (EU)",
  },
  {
    id: "pubg-eu",
    name: "PUBG EU",
    host: "dynamodb.eu-west-1.amazonaws.com",
    port: 443,
    games: "PUBG",
    region: "Dublin (EU West)",
  },
  {
    id: "fortnite-eu",
    name: "Epic Games EU",
    host: "dynamodb.eu-west-3.amazonaws.com",
    port: 443,
    games: "Fortnite",
    region: "Paris (EU West)",
  },
];

let cachedResults: CachedResults = {
  servers: [],
  lastUpdate: null,
  internetSpeed: "2 Gbit/s",
};

// Measure TCP connect time (most accurate for estimating game ping)
function tcpPing(host: string, port: number, timeout: number = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new Socket();

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const latency = Math.round(performance.now() - start);
      cleanup();
      resolve(latency);
    });

    socket.on("timeout", () => {
      cleanup();
      resolve(null);
    });

    socket.on("error", () => {
      cleanup();
      resolve(null);
    });

    socket.connect(port, host);
  });
}

async function measurePing(server: Server): Promise<ServerResult> {
  const attempts = 3;
  const pings: number[] = [];

  for (let i = 0; i < attempts; i++) {
    const latency = await tcpPing(server.host, server.port);
    if (latency !== null) {
      pings.push(latency);
    }
  }

  if (pings.length === 0) {
    return {
      ...server,
      ping: null,
      status: "error",
    };
  }

  // Use minimum ping (most accurate - less affected by jitter)
  const minPing = Math.min(...pings);

  return {
    ...server,
    ping: minPing,
    status: "online",
  };
}

async function updatePings(): Promise<void> {
  const results = await Promise.all(SERVERS.map(measurePing));
  cachedResults = {
    servers: results,
    lastUpdate: new Date().toISOString(),
    internetSpeed: "2 Gbit/s",
  };
  console.log(
    `[${new Date().toISOString()}] Ping updated:`,
    results.map((r) => `${r.id}:${r.ping}ms`).join(", ")
  );
}

// Update every 5 minutes
setInterval(updatePings, 5 * 60 * 1000);
updatePings(); // Run once on startup

serve({
  port: Number(process.env.PORT) || 3001,
  fetch(req) {
    const url = new URL(req.url);

    // CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/ping") {
      return new Response(JSON.stringify(cachedResults), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === "/health") {
      return new Response("OK", { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Ping monitor running on port ${process.env.PORT || 3001}`);
