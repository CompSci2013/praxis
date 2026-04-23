FROM node:18-alpine AS builder
WORKDIR /app
COPY api/package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
RUN addgroup -S praxis && adduser -S praxis -G praxis

COPY --from=builder /app/node_modules ./node_modules
COPY api/src ./src

# Copy knowledge graph content into the image
COPY layer-1 /content/layer-1
COPY layer-2 /content/layer-2
COPY reference-app /content/reference-app
COPY GRAPH.md /content/GRAPH.md

ENV NODE_ENV=production
ENV PORT=3001
ENV CONTENT_PATH=/content
ENV RAG_URL=http://thor:30800

USER praxis
EXPOSE 3001
CMD ["node", "src/index.js"]
