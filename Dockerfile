ARG NODE_VERSION=14.18.0
FROM node:${NODE_VERSION}-alpine3.14 as build

ARG NPM_TOKEN
ARG APP_CONFIG=staging
ARG SERVICE_VERSION=0.0.0
WORKDIR /app
COPY --chown=node:node . ${WORKDIR}

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock
RUN echo -e "@weeb-vip:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" > .npmrc
RUN yarn install
COPY . .
RUN yarn build
RUN echo $SERVICE_VERSION > /app/dist/version.txt

FROM nginx:1.20.0
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
