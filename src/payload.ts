export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  games: string;
  region: string;
}

export interface ServerResult extends Server {
  ping: number | null;
  status: "online" | "offline" | "error";
}

export interface CachedResults {
  servers: ServerResult[];
  lastUpdate: string | null;
  internetSpeed: string;
}

export type PublicServer = Omit<ServerResult, "host" | "port">;

export interface PublicPayload {
  servers: PublicServer[];
  lastUpdate: string | null;
  internetSpeed: string;
}

// Ölçüm hedefleri bölge vekilidir, oyun firmasının kendi sunucusu değil.
// Yanıtta görünürlerse kartlardaki isimler denetlemeye açık hâle geliyor.
export function toPublicPayload(results: CachedResults): PublicPayload {
  return {
    servers: results.servers.map(({ host: _host, port: _port, ...gorunen }) => gorunen),
    lastUpdate: results.lastUpdate,
    internetSpeed: results.internetSpeed,
  };
}
