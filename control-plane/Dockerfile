FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY control-plane/package.json ./control-plane/package.json
COPY shared/package.json ./shared/package.json
RUN npm install

FROM base AS build
COPY shared ./shared
COPY control-plane ./control-plane
RUN npm run build -w shared && npm run build -w control-plane

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/shared ./shared
COPY --from=build /app/control-plane ./control-plane
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "control-plane"]
