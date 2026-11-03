# Poker room server (staging) on Fly.io Tokyo, next to the Supabase database (ap-northeast-1).
FROM node:24-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build:poker-server
ENV NODE_ENV=production POKER_ROOM_HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["node", ".poker-server/lib/poker/room-server-entry.js"]
