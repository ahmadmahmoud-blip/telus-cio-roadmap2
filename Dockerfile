# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client and build Next.js
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production

# Automatically leverage the standalone folder created by Next.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080
ENV PORT 8080
# Prisma engine needs to be available in the final image
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

CMD ["node", "server.js"]
