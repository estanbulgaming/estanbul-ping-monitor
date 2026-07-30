FROM oven/bun:1

# Coolify sağlık kontrolünü konteynerin İÇİNDE wget/curl ile koşuyor, ikisi de temel
# imajda yok. Bu yüzden yeni konteyner 10 denemede "unhealthy" sayılıp deploy geri
# alınıyordu — kod sağlamken. Kod katmanlarından önce: imaj değişmedikçe cache'te kalır.
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY . .

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
