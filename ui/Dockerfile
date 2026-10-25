
FROM node:22-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.15.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG API_URL=http://api:3001
ENV API_URL=${API_URL}
ENV NODE_ENV=production

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
