FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm install

FROM base AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/client ./client
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["npm", "run", "start", "-w", "server"]
