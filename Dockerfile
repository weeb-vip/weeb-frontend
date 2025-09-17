# ---- Build stage ----
ARG NODE_VERSION=20.17.0
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

ENV APP_CONFIG=staging
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION

COPY package.json yarn.lock ./
RUN corepack enable && yarn set version stable
RUN yarn install --immutable
COPY . .
RUN yarn install --immutable
RUN yarn build

# ---- Runtime stage ----
FROM nginx:alpine

# tini helps with signal + zombie reaping; -g forwards to the whole process group
RUN apk add --no-cache tini

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

ENTRYPOINT ["/sbin/tini", "-g", "--"]
CMD ["nginx", "-g", "daemon off;"]
