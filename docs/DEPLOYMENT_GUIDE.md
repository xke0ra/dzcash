# Deployment & Infrastructure Guide: DZCASH

This document details the configuration instructions for local development and cloud production deployment.

---

## 💻 Local Development Setup (Quick Start)

### Prerequisites
- Docker & Docker Compose installed.

### Launching the Stack
1. Clone the project and configure the root environment parameters:
   - Root `.env`: [env configuration](file:///c:/xampp/htdocs/dzcash/.env)
2. Build and launch all services with one command:
   ```bash
   docker compose up --build
   ```
3. The containers will automatically bootstrap:
   - Run database migrations (`prisma migrate deploy`).
   - Run NestJS backend server (`http://localhost:4000`).
   - Build and start Next.js frontend production bundle (`http://localhost:3000`).
   - Launch Nginx reverse proxy routing web requests (`http://localhost:80`).
4. Access the platforms:
   - Web application: Open [http://localhost](http://localhost) in your browser.
   - API endpoints: Open [http://localhost/api](http://localhost/api) (or backend port [http://localhost:4000/api](http://localhost:4000/api)).

---

## ☁️ Cloud Production Deployment Guide

We recommend deploy on Linux VPS (Ubuntu 20.04/22.04 LTS) with Docker.

### 1. Host Configurations
Install Docker, Docker Compose, and git:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git
```

### 2. Secure Configuration Secrets
Create a production `.env` file containing secure, complex random tokens:
- Use custom passwords for `POSTGRES_PASSWORD`.
- Use complex random strings for `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate using `openssl rand -base64 32`).
- Bind `PORT` and configure actual offer network secret keys.

### 3. Database Management & Backups
To run manual database migrations or check schemas in production:
- Use Prisma inside backend container:
  ```bash
  docker compose exec backend npx prisma status
  ```
- Schedule periodic backups of the postgres volume using `pg_dump`:
  ```bash
  docker exec -t dzcash_postgres pg_dumpall -c -U dzuser > dump_`date +%d-%m-%Y"_"%H_%M_%S`.sql
  ```

### 4. Enable HTTPS SSL (Nginx + Let's Encrypt)
In production, update `nginx/default.conf` to redirect Port 80 to 443 and configure Certbot Let's Encrypt SSL certificates.
