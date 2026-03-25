FROM ghcr.io/ingeniator/base-node:18 AS builder
WORKDIR /app
COPY . .
RUN echo "build service-a"

FROM builder AS runtime
CMD ["node", "server.js"]
