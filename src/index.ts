import { serve } from "bun";
import { Socket } from "net";
import {
  toPublicPayload,
  type CachedResults,
  type Server,
  type ServerResult,
} from "./payload";

// Server endpoints for TCP ping measurement
// Using actual game server IPs where available for accurate RTT measurement
const SERVERS: Server[] = [
  {
    id: "riot-tr",
    name: "Riot Games TR",
    // TurkNet İstanbul (RIPE: TR-TURKNET). Alan adı değil IP: önceki hedef radore.com
    // Cloudflare'e geçince ölçüm sessizce Frankfurt'a kaydı ve kart 1ms yerine 38ms gösterdi.
    // IP sabitlemek CDN araya girmesini yapısal olarak engeller; hedef ölürse kart "-" gösterir,
    // yani yanlış sayı yayınlamak yerine görünür şekilde başarısız olur.
    host: "95.70.148.80",
    port: 443,
    games: "Valorant, LoL",
    region: "İstanbul (TR)",
  },
  {
    id: "faceit-eu",
    name: "Faceit EU",
    host: "dynamodb.eu-central-1.amazonaws.com", // AWS Frankfurt - Faceit uses Hetzner but TCP 443 blocked
    port: 443,
    games: "CS2 Turnuva",
    region: "Frankfurt (EU)",
  },
  {
    id: "steam-eu",
    name: "Steam EU",
    host: "dynamodb.eu-central-1.amazonaws.com", // AWS Frankfurt - Valve servers block TCP 443
    port: 443,
    games: "CS2, Dota 2",
    region: "Frankfurt (EU)",
  },
  {
    id: "pubg-eu",
    name: "PUBG EU",
    host: "dynamodb.eu-west-1.amazonaws.com", // PUBG uses AWS Dublin
    port: 443,
    games: "PUBG",
    region: "Dublin (EU West)",
  },
  {
    id: "fortnite-eu",
    name: "Epic Games EU",
    host: "dynamodb.eu-west-3.amazonaws.com", // Epic uses AWS Paris
    port: 443,
    games: "Fortnite",
    region: "Paris (EU West)",
  },
  {
    id: "cod-eu",
    name: "Call of Duty EU",
    host: "dynamodb.eu-west-2.amazonaws.com", // Activision uses cloud (London)
    port: 443,
    games: "Warzone, MW3",
    region: "London (EU)",
  },
  {
    id: "blizzard-eu",
    name: "Blizzard EU",
    host: "dynamodb.eu-west-3.amazonaws.com", // AWS Paris - Blizzard EU servers are in Paris
    port: 443,
    games: "WoW, Overwatch 2",
    region: "Paris (EU)",
  },
  {
    id: "ea-eu",
    name: "EA EU",
    host: "dynamodb.eu-central-1.amazonaws.com", // AWS Frankfurt - EA servers block TCP 443
    port: 443,
    games: "Battlefield, FC 25",
    region: "Frankfurt (EU)",
  },
  {
    id: "arc-eu",
    name: "Embark EU",
    host: "dynamodb.eu-central-1.amazonaws.com", // ARC has servers in Amsterdam/Brussels, closest to Frankfurt
    port: 443,
    games: "ARC Raiders",
    region: "Amsterdam (EU)",
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
      return new Response(JSON.stringify(toPublicPayload(cachedResults)), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // "/" de sağlık yanıtı veriyor: Coolify'ın sağlık kontrolü varsayılan olarak "/"
    // istiyor ve 404 alınca konteyner unhealthy sayılıp deploy geri alınıyor. Yol
    // Coolify'da ayarlanabilir ama repo dışında kalır; burada karşılamak dağıtımı
    // görünmeyen bir ayara bağımlı olmaktan çıkarıyor.
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response("OK", { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Ping monitor running on port ${process.env.PORT || 3001}`);
