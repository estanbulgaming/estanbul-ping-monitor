import { describe, expect, test } from "bun:test";
import { handleRequest } from "./router";
import type { CachedResults } from "./payload";

const ornek: CachedResults = {
  servers: [
    {
      id: "riot-tr",
      name: "Riot Games TR",
      host: "95.70.148.80",
      port: 443,
      games: "Valorant, LoL",
      region: "İstanbul (TR)",
      ping: 2,
      status: "online",
    },
  ],
  lastUpdate: "2026-07-30T16:14:11.416Z",
  internetSpeed: "2 Gbit/s",
};

const istek = (yol: string, method = "GET") =>
  new Request(`http://localhost:3001${yol}`, { method });

describe("sağlık kontrolü sözleşmesi", () => {
  // Coolify bu uygulamada health_check_path=/ ile yapılandırılmış ve 404 alınca
  // konteyneri unhealthy sayıp deploy'u geri alıyor. Kök yol bir kez 404'e dönerse
  // dağıtım sessizce kırılır; bu yüzden testle sabitlendi.
  test("kök yol 200 döner — Coolify varsayılan yolu", async () => {
    const yanit = handleRequest(istek("/"), ornek);

    expect(yanit.status).toBe(200);
    expect(await yanit.text()).toBe("OK");
  });

  test("/health 200 döner", async () => {
    const yanit = handleRequest(istek("/health"), ornek);

    expect(yanit.status).toBe(200);
    expect(await yanit.text()).toBe("OK");
  });

  test("HEAD isteği de 200 döner — wget --spider HEAD gönderiyor", () => {
    expect(handleRequest(istek("/", "HEAD"), ornek).status).toBe(200);
  });

  test("bilinmeyen yol 404 döner — sağlık yanıtı catch-all değil", () => {
    expect(handleRequest(istek("/olmayan-yol"), ornek).status).toBe(404);
  });
});

describe("/api/ping", () => {
  test("ölçüm hedeflerini sızdırmaz", async () => {
    const govde = await handleRequest(istek("/api/ping"), ornek).text();

    expect(govde).not.toContain("95.70.148.80");
    expect(govde).not.toContain("host");
    expect(govde).not.toContain("port");
  });

  test("kartların ihtiyacı olan alanları verir", async () => {
    const yanit = handleRequest(istek("/api/ping"), ornek);
    const govde = JSON.parse(await yanit.text());

    expect(yanit.headers.get("Content-Type")).toContain("application/json");
    expect(govde.servers[0]).toEqual({
      id: "riot-tr",
      name: "Riot Games TR",
      games: "Valorant, LoL",
      region: "İstanbul (TR)",
      ping: 2,
      status: "online",
    });
    expect(govde.lastUpdate).toBe("2026-07-30T16:14:11.416Z");
  });
});

describe("CORS", () => {
  test("preflight isteği yanıtlanır", () => {
    const yanit = handleRequest(istek("/api/ping", "OPTIONS"), ornek);

    expect(yanit.status).toBe(200);
    expect(yanit.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  test("her yanıt CORS başlığı taşır", () => {
    for (const yol of ["/", "/health", "/api/ping", "/olmayan-yol"]) {
      expect(handleRequest(istek(yol), ornek).headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });
});
