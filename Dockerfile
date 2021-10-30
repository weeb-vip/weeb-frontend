ARG NODE_VERSION=14.18.0
ARG NPM_TOKEN

FROM node:${NODE_VERSION}-alpine3.14 as build

ENV NPM_TOKEN=$NPM_TOKEN
WORKDIR /app
COPY --chown=node:node . ${WORKDIR}

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock

RUN yarn install
COPY . .
RUN yarn build


FROM nginx:1.20.0
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html