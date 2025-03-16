FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm ci
RUN npm run build

FROM node:20-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN npm ci --omit=dev

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]