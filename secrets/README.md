# Docker Secrets

Create these files in this directory for production deployment:

- `postgres_password.txt`
- `redis_password.txt`
- `jwt_secret.txt`
- `jwt_refresh_secret.txt`
- `cpx_secret.txt`
- `offertoro_secret.txt`
- `ipqs_api_key.txt`

Each file should contain the secret value as plain text (no trailing newline).

These files are gitignored and must be manually created on the production server.
