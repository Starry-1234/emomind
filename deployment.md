# Deployment Guide

## Docker Deploy

The recommended way to deploy emomind is with Docker Compose on a server.

### Server Requirements

- Linux server (Ubuntu 20.04+ recommended)
- Docker & Docker Compose installed
- A domain name with DNS pointing to the server IP
- Traefik handles routing and HTTPS certificates

### Setup Steps

**1. Prepare the server**

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
# Install Docker Compose
apt install docker-compose -y
```

**2. Copy project files to server**

```bash
scp -r emomind-dir/* user@your-server:/root/code/emomind/
```

**3. Configure environment**

On the server, copy and edit env files:

```bash
cd /root/code/emomind
cp .env.example .env
cp frontend/.env.example frontend/.env
nano .env  # fill in real passwords and keys
```

Key settings to change in `.env`:
- `SECRET_KEY` — generate a random 64-char string
- `POSTGRES_PASSWORD` — strong database password
- `FIRST_SUPERUSER_PASSWORD` — admin password
- `DOMAIN` — your domain name

**4. Start services**

```bash
docker compose up -d
```

**5. Initialize database**

```bash
docker compose exec backend bash
# inside container:
alembic upgrade head
python app/initial_data.py
exit
```

**6. Set up admin user**

Visit `https://your-domain.com` and login with:
- Email: `admin@fastapi`
- Password: `changethis`

Then create your real admin account and delete the default one.

## Traefik Setup

Traefik is included in the stack and handles automatic HTTPS via Let's Encrypt.

The docker-compose already has Traefik configured. No additional setup needed if following the steps above.

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

## Useful Commands

```bash
# View logs
docker compose logs
docker compose logs backend

# Restart a service
docker compose restart backend

# Stop everything
docker compose down
```
