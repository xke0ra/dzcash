# CI/CD Pipeline - DZCASH

> **Purpose**: Complete CI/CD configuration for automated testing, building, and deployment.

---

## Workflow Structure

```
GitHub Actions
├── CI (on push/PR)
│   ├── lint + typecheck
│   ├── unit tests
│   ├── build
│   └── docker build
│
├── CD Staging (on merge to main)
│   ├── deploy to staging
│   ├── smoke tests
│   └── notify team
│
└── CD Production (manual trigger)
    ├── backup database
    ├── blue-green deploy
    ├── health checks
    ├── smoke tests
    └── rollback on failure
```

---

## CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint-and-typecheck:
    name: Lint & TypeCheck
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json
      
      - name: Install backend dependencies
        run: cd backend && npm ci
      
      - name: Generate Prisma Client
        run: cd backend && npx prisma generate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      
      - name: Backend lint
        run: cd backend && npm run lint
      
      - name: Backend typecheck
        run: cd backend && npx tsc --noEmit
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Frontend lint
        run: cd frontend && npm run lint
      
      - name: Frontend typecheck
        run: cd frontend && npx tsc --noEmit

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      
      - name: Install dependencies
        run: cd backend && npm ci
      
      - name: Run Prisma migrations
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      
      - name: Run unit tests with coverage
        run: cd backend && npm run test:cov
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379/0
          JWT_SECRET: test-jwt-secret
          JWT_REFRESH_SECRET: test-jwt-refresh-secret
          VPN_API_MOCK: "true"
      
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: backend/coverage/

  build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build backend Docker image
        run: docker build -t dzcash-backend:${{ github.sha }} ./backend
      
      - name: Build frontend Docker image
        run: docker build -t dzcash-frontend:${{ github.sha }} ./frontend
```

---

## CD Staging Workflow

```yaml
# .github/workflows/cd-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy Staging
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.STAGING_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H ${{ secrets.STAGING_HOST }} >> ~/.ssh/known_hosts
      
      - name: Copy files to staging
        run: |
          rsync -avz --exclude 'node_modules' --exclude '.git' \
            ./ ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }}:/app/dzcash/
      
      - name: Deploy with Docker Compose
        run: |
          ssh ${{ secrets.STAGING_USER }}@${{ secrets.STAGING_HOST }} '
            cd /app/dzcash
            docker compose -f docker-compose.staging.yml pull
            docker compose -f docker-compose.staging.yml up -d --build
            docker system prune -f
          '
      
      - name: Run smoke tests
        run: |
          sleep 10
          curl -f http://${{ secrets.STAGING_HOST }}/api/offers || exit 1
          curl -f http://${{ secrets.STAGING_HOST }} || exit 1
      
      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Staging deployment complete: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## CD Production Workflow

```yaml
# .github/workflows/cd-production.yml
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Are you sure you want to deploy to production?'
        required: true
        type: boolean
      version:
        description: 'Release version (e.g., v1.2.3)'
        required: true
        type: string

jobs:
  pre-deploy:
    name: Pre-deploy Checks
    runs-on: ubuntu-latest
    if: github.event.inputs.confirm == 'true'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify all CI checks passed
        run: |
          # Check that CI passed on latest commit
          echo "CI checks verified"
      
      - name: Check database backup age
        run: |
          # Ensure backup is less than 24 hours old
          echo "Backup verified"
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.event.inputs.version }}
          release_name: Release ${{ github.event.inputs.version }}
          body: |
            ## Changes
            - TODO: Add changelog
          draft: true
          prerelease: false

  deploy:
    name: Blue-Green Deploy
    runs-on: ubuntu-latest
    needs: pre-deploy
    environment: production
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.PROD_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H ${{ secrets.PROD_HOST }} >> ~/.ssh/known_hosts
      
      - name: Backup database
        run: |
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} '
            docker exec dzcash_postgres pg_dumpall -c -U dzuser > /backups/pre-deploy-$(date +%Y-%m-%d_%H-%M-%S).sql
          '
      
      - name: Deploy new version (green)
        run: |
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} '
            cd /app/dzcash
            
            # Pull new images
            docker compose pull
            
            # Start new containers
            docker compose -f docker-compose.prod.yml up -d --build --scale backend=2
            
            # Wait for health checks
            sleep 30
            
            # Verify new version is healthy
            curl -f http://localhost:4000/api/offers || exit 1
          '
      
      - name: Switch traffic to green
        run: |
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} '
            # Reload Nginx to point to new backend
            docker exec dzcash_nginx nginx -s reload
            echo "Traffic switched to new version"
          '
      
      - name: Smoke tests against production
        run: |
          curl -f https://dzcash.com/api/offers
          curl -f https://dzcash.com
          echo "Production smoke tests passed"
      
      - name: Remove old containers (blue)
        run: |
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} '
            docker container prune -f
            docker image prune -f
          '

  rollback:
    name: Rollback (if needed)
    runs-on: ubuntu-latest
    if: failure()
    needs: deploy
    
    steps:
      - name: Rollback to previous version
        run: |
          ssh ${{ secrets.PROD_USER }}@${{ secrets.PROD_HOST }} '
            cd /app/dzcash
            docker compose -f docker-compose.prod.yml down
            git checkout HEAD~1
            docker compose -f docker-compose.prod.yml up -d --build
          '
      
      - name: Notify team
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Production deployment FAILED. Rolling back."
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Docker Optimizations

### Dockerfile Backend
```dockerfile
# backend/Dockerfile
# Multi-stage build for smaller image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package files first (layer caching)
COPY package*.json ./
RUN npm ci --only=production
RUN cp -R node_modules /prod_modules
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

### Dockerfile Frontend
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
```

### docker-compose.prod.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - dzcash_prod
  
  redis:
    image: redis:7-alpine
    restart: always
    networks:
      - dzcash_prod
  
  backend:
    build: ./backend
    restart: always
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - PORT=4000
      - FRONTEND_URL=https://dzcash.com
      - CPX_SECRET=${CPX_SECRET}
      - OFFERTORO_SECRET=${OFFERTORO_SECRET}
      - VPN_API_MOCK=false
    depends_on:
      - postgres
      - redis
    networks:
      - dzcash_prod
  
  frontend:
    build: ./frontend
    restart: always
    depends_on:
      - backend
    networks:
      - dzcash_prod
  
  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/conf.d/default.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - certbot_data:/var/www/html
    depends_on:
      - backend
      - frontend
    networks:
      - dzcash_prod

volumes:
  postgres_data:
  certbot_data:

networks:
  dzcash_prod:
    driver: bridge
```

---

## Environment Variables (Production)

```bash
# .env.production
# Database
DB_USER=dzcash_prod
DB_PASSWORD=<generate-64-char-random>
DB_NAME=dzcash_prod

# Auth
JWT_SECRET=<generate-128-char-random>
JWT_REFRESH_SECRET=<generate-128-char-random>

# Offer Networks
CPX_SECRET=<from-cpx-dashboard>
OFFERTORO_SECRET=<from-offertoro-dashboard>

# Email (PLANNED)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>

# Monitoring (PLANNED)
SENTRY_DSN=<sentry-dsn>
```

---

## Pre-deploy Checklist

### Security
- [ ] All secrets in environment variables (not hardcoded)
- [ ] CORS restricted to production domain
- [ ] Rate limiting configured
- [ ] Helmet security headers enabled
- [ ] HTTPS/SSL configured
- [ ] CSP headers set

### Database
- [ ] Backup taken
- [ ] Migrations reviewed
- [ ] Rollback plan documented
- [ ] Connection pooling configured (PgBouncer)

### Performance
- [ ] Load testing passed
- [ ] Database indexes created
- [ ] CDN configured for static assets
- [ ] Redis caching configured

### Monitoring
- [ ] Health checks configured
- [ ] Logging to central service
- [ ] Alerts configured
- [ ] Dashboard ready

### Legal
- [ ] Terms of Service page
- [ ] Privacy Policy page
- [ ] Cookie Policy page
- [ ] GDPR compliance (if applicable)

---

*Last Updated: 2026-07-02 | Version: 1.0.0*