FROM node:24-alpine

ENV NODE_ENV=production
EXPOSE 8080/tcp

LABEL maintainer="Holy Unblocker"
LABEL summary="Holy Unblocker Frontend"
LABEL description="Example application of Holy Unblocker's frontend which can be deployed in production."

WORKDIR /app

COPY . .
COPY ./config/config.example.js ./config/config.js

RUN apk add --upgrade --no-cache python3 make g++
RUN npm install
RUN npm run build

ENTRYPOINT [ "node" ]
CMD ["run-server.js"]