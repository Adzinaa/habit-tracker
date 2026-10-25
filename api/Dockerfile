FROM node:22-slim

WORKDIR /app

# Install dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# The database lives in /data, which docker-compose mounts as a named volume.
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/data/habit-tracker.db
USER node
EXPOSE 3001

# Run node directly (not through npm) so SIGTERM reaches it and the database closes cleanly.
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server.js"]
