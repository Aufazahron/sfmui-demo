FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
