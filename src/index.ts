import { serve } from "bun";

interface Server {
  id: string;
  name: string;
  endpoint: string; // AWS DynamoDB endpoint for region proxy
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

// AWS DynamoDB endpoints as proxy for game server regions
// Game servers are typically hosted in these same AWS/cloud regions
const SERVERS: Server[] = [
  {
    id: "riot-tr",
    name: "Riot Games TR",
    endpoint: "https://dynamodb.eu-central-1.amazonaws.com",
    games: "Valorant, LoL",
    region: "Frankfurt (EU)",
  },
  {
    id: "faceit-eu",
    name: "Faceit EU",
    endpoint: "https://dynamodb.eu-central-1.amazonaws.com",
    games: "CS2 Turnuva",
    region: "Frankfurt (EU)",
  },
  {
    id: "steam-eu",
    name: "Steam EU",
    endpoint: "https://dynamodb.eu-central-1.amazonaws.com",
    games: "CS2, Dota 2",
    region: "Frankfurt (EU)",
  },
  {
    id: "pubg-eu",
    name: "PUBG EU",
    endpoint: "https://dynamodb.eu-west-1.amazonaws.com",
    games: "PUBG",
    region: "Dublin (EU West)",
  },
  {
    id: "fortnite-eu",
    name: "Epic Games EU",
    endpoint: "https://dynamodb.eu-west-3.amazonaws.com",
    games: "Fortnite",
    region: "Paris (EU West)",
  },
];

let cachedResults: CachedResults = {
  servers: [],
  lastUpdate: null,
  internetSpeed: "2 Gbit/s",
};

// Measure ping using HTTP fetch timing (same technique as gameserverping.com)
async function measurePing(server: Server): Promise<ServerResult> {
  const attempts = 3;
  const pings: number[] = [];

  for (let i = 0; i < attempts; i++) {
    const start = performance.now();
    try {
      // Use GET with abort signal for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(server.endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);

      // AWS returns various status codes (403, 404, etc.) - any response means server is reachable
      pings.push(latency);
    } catch {
      // Timeout or network error - skip this attempt
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
