FROM node:20-bookworm-slim

WORKDIR /app

# python3 + pdfplumber/openpyxl: usados pelo gerador de relatorio (src/relatorios/scripts)
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

RUN pip3 install --break-system-packages --no-cache-dir -r src/relatorios/scripts/requirements.txt

ENV NODE_ENV=production
EXPOSE 3001

# migrate roda via ts-node direto de src/ (os .sql nao vao para dist/)
CMD ["sh", "-c", "npm run migrate && npm run start:prod"]
