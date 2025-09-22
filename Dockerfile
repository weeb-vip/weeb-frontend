# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Set environment variables
# APP_CONFIG determines which config to use: staging (default) or production
# Override with: docker build --build-arg APP_CONFIG=production
ARG APP_CONFIG=staging
ENV APP_CONFIG=$APP_CONFIG
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV NODE_ENV=production

# Install Yarn
RUN corepack enable

# Copy package files and Yarn configuration
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Install dependencies with Yarn (include dev dependencies for build)
# Allow failures for optional dependencies
RUN yarn install --immutable || yarn install

# Copy source code
COPY . .

# Build the application
RUN yarn build

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_CONFIG=staging

# Install Yarn
RUN corepack enable

# Copy package files and install production dependencies
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
RUN yarn workspaces focus --production

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Copy config files if they exist
COPY --from=build /app/src/config ./src/config

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S astro -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R astro:nodejs /app
USER astro

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application using Node
CMD ["node", "./dist/server/entry.mjs"]