FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY knowledge ./knowledge

RUN mkdir -p .index .state .outbox .logs \
    && node src/cli.mjs index \
    && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV CHATBOT_API_HOST=0.0.0.0
ENV CHATBOT_API_PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["node", "src/server.mjs"]
