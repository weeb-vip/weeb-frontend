# ---- Build stage ----
FROM oven/bun:1.1.34-alpine AS build

WORKDIR /app

# Set environment variables
ENV APP_CONFIG=staging
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV NODE_ENV=production

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies with Bun (include dev dependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# ---- Production stage ----
FROM oven/bun:1.1.34-alpine AS production

WORKDIR /app

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV APP_CONFIG=staging

# Copy package files and install only production dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

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
  CMD bun --version || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application using Bun
CMD ["bun", "run", "start"]