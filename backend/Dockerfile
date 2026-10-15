FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
