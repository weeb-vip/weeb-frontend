ARG NODE_VERSION=18.15.0

FROM node:${NODE_VERSION}-alpine3.16 as build

WORKDIR /app
ENV APP_CONFIG=staging
COPY --chown=node:node . ${WORKDIR}

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock

RUN corepack enable && yarn set version stable
RUN yarn install
COPY . .
RUN yarn build


FROM nginx:1.20.0
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
