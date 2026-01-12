# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install Python, PostgreSQL client, git, and dependencies needed for scripts
# - python3/pip: For db:seed script (extract_mitre_data.py)
# - postgresql-client: For pg_dump backups via admin API
# - git: For cloning Sigma rules repository
RUN apk add --no-cache python3 py3-pip postgresql-client git && \
    pip3 install requests mitreattack-python --break-system-packages

WORKDIR /app

# Clone Sigma rules repository for local rule matching (avoids GitHub API rate limits)
RUN git clone --depth 1 https://github.com/SigmaHQ/sigma.git /app/data/sigma

# Copy package files and install dependencies
# Note: We install all dependencies (not just prod) to include tsx for maintenance scripts
COPY package*.json ./
RUN npm install

# Copy configuration files
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Copy source directories
COPY shared ./shared
COPY scripts ./scripts
COPY server ./server
COPY client ./client
COPY mappings ./mappings

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "dist/index.cjs"]
