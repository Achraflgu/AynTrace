FROM node:20-alpine

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server ./
COPY tracker-page /app/tracker-page

EXPOSE 3001

CMD ["npm", "start"]
