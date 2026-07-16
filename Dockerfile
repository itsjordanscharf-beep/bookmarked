# Builds the React client and Express+SQLite server, then serves both from
# a single Node process so the deployed app is one service, one URL.

FROM node:22-slim AS client
WORKDIR /app/client
# Vite env vars are baked in at build time, so this must be a build ARG
# (Railway auto-populates it from the service's configured variables), not
# just a runtime environment variable on the final image.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
RUN npm run build

FROM node:22-slim AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server /app/server/package.json /app/server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=server /app/server/dist ./dist
COPY --from=client /app/client/dist ./public

EXPOSE 4000
CMD ["node", "dist/index.js"]
