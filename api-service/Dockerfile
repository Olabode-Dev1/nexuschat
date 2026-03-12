# alpine = stripped down Linux, keeps image ~50MB instead of ~900MB
FROM node:18-alpine

# all commands from here run inside /app
WORKDIR /app

# copy package files FIRST — Docker caches this layer
# if your code changes but package.json doesn't, npm install is skipped
COPY package*.json ./
RUN npm install --omit=dev

# copy source code after deps
COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/index.js"]