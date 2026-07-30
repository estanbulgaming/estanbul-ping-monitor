import { toPublicPayload, type CachedResults } from "./payload";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// serve() dışında tutuluyor ki yönlendirme sözleşmesi sunucu ayağa kaldırmadan
// test edilebilsin — dağıtım bu sözleşmeye bağlı (aşağıdaki kök yol notu).
export function handleRequest(req: Request, results: CachedResults): Response {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (url.pathname === "/api/ping") {
    return new Response(JSON.stringify(toPublicPayload(results)), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }

  // "/" de sağlık yanıtı veriyor: Coolify'ın bu uygulamadaki ayarı
  // health_check_path=/ ve 404 alınca konteyner unhealthy sayılıp deploy geri
  // alınıyor. Burada karşılamak dağıtımı yol ayarına bağımlı olmaktan çıkarıyor.
  if (url.pathname === "/health" || url.pathname === "/") {
    return new Response("OK", { headers: corsHeaders });
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}
