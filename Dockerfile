FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci --prefix client

COPY . .

RUN npm run build --prefix client

# Final image
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

RUN apk add --no-cache protobuf

COPY --from=builder /app/client/dist ./client/dist

COPY src ./src
COPY swagger.yaml ./

RUN npm run proto:generate

EXPOSE 3000

CMD ["npm", "start"]
