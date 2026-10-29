FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY server.js curriculum-sources.js ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","server.js"]
