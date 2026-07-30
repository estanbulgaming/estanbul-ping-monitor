import { describe, expect, test } from "bun:test";
import { toPublicPayload, type CachedResults } from "./payload";

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
    {
      id: "steam-eu",
      name: "Steam EU",
      host: "dynamodb.eu-central-1.amazonaws.com",
      port: 443,
      games: "CS2, Dota 2",
      region: "Frankfurt (EU)",
      ping: null,
      status: "error",
    },
  ],
  lastUpdate: "2026-07-30T16:14:11.416Z",
  internetSpeed: "2 Gbit/s",
};

describe("toPublicPayload", () => {
  test("ölçüm hedeflerini dışarı sızdırmaz", () => {
    const sonuc = toPublicPayload(ornek);

    for (const sunucu of sonuc.servers) {
      expect(sunucu).not.toHaveProperty("host");
      expect(sunucu).not.toHaveProperty("port");
    }

    // Hedefler serileştirilmiş yanıtta da geçmemeli
    const json = JSON.stringify(sonuc);
    expect(json).not.toContain("95.70.148.80");
    expect(json).not.toContain("amazonaws.com");
  });

  test("ekranda görünen alanları korur", () => {
    const [ilk] = toPublicPayload(ornek).servers;

    expect(ilk).toEqual({
      id: "riot-tr",
      name: "Riot Games TR",
      games: "Valorant, LoL",
      region: "İstanbul (TR)",
      ping: 2,
      status: "online",
    });
  });

  test("ölçülemeyen sunucuyu null ping ile aktarır", () => {
    const sonuc = toPublicPayload(ornek);

    expect(sonuc.servers[1]?.ping).toBeNull();
    expect(sonuc.servers[1]?.status).toBe("error");
  });

  test("üst düzey alanları olduğu gibi taşır", () => {
    const sonuc = toPublicPayload(ornek);

    expect(sonuc.lastUpdate).toBe("2026-07-30T16:14:11.416Z");
    expect(sonuc.internetSpeed).toBe("2 Gbit/s");
  });

  test("kaynak nesneyi değiştirmez", () => {
    toPublicPayload(ornek);

    expect(ornek.servers[0]?.host).toBe("95.70.148.80");
  });
});
