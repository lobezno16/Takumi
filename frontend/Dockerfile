# ---- Dev stage ----
FROM node:22-alpine AS dev
WORKDIR /app
# Deterministic installs from the committed lockfile so every clone/build
# resolves identical dependency versions (incl. the map libraries).
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- Build stage ----
FROM dev AS build
RUN npm run build

# ---- Production stage ----
FROM nginxinc/nginx-unprivileged:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8080/ || exit 1
