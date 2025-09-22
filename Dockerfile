# ---- Build stage ----
FROM oven/bun:1-alpine AS build

WORKDIR /app

# Set environment variables
# APP_CONFIG determines which config to use: staging (default) or production
# Override with: docker build --build-arg APP_CONFIG=production
ARG APP_CONFIG=staging
ENV APP_CONFIG=$APP_CONFIG
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV NODE_ENV=production

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with Bun (much faster than yarn/npm)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# ---- Production stage ----
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_CONFIG=staging

# Copy package files and install production dependencies
COPY package.json bun.lockb* ./
RUN bun install --production --frozen-lockfile

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Copy config files if they exist
COPY --from=build /app/src/config ./src/config

# Create non-root user
RUN addgroup -g 1001 -S bunuser && \
    adduser -S astro -u 1001 -G bunuser

# Change ownership of the app directory
RUN chown -R astro:bunuser /app
USER astro

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --version || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application using Bun
CMD ["bun", "run", "./dist/server/entry.mjs"]