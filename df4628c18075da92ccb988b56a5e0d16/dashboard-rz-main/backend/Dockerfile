FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

# migrate roda via ts-node direto de src/ (os .sql nao vao para dist/)
CMD ["sh", "-c", "npm run migrate && npm run start:prod"]
