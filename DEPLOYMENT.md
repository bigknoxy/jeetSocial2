# 🚀 Production Deployment Guide - jeetSocial

This guide provides exact, step-by-step instructions for deploying jeetSocial to a production environment (VPS) and configuring your administrative credentials.

## 🛠 Prerequisites

- A VPS running Linux (e.g., Ubuntu).
- Docker and Docker Compose installed on the VPS.
- A domain name (e.g., `jeetsocial.com`) pointing to your VPS IP.
- SSH access to your VPS.

## 📦 Deployment Steps

### 1. Prepare the Deployment Directory
Connect to your VPS and create a directory for the application:
```bash
ssh user@your-vps-ip
mkdir -p ~/jeetsocial
cd ~/jeetsocial
```

### 2. Configure Environment Variables
Create a `.env` file in the `~/jeetsocial` directory on your VPS. This is where you **MUST** set your admin credentials:

```bash
nano .env
```

Paste the following content and replace the values with your desired credentials:
```env
# Admin Credentials (SET THESE FOR PRODUCTION)
ADMIN_USERNAME=your_secure_admin_name
ADMIN_PASSWORD=your_super_secure_password_123

# App Configuration
NODE_ENV=production
MODERATION_SERVICE_URL=http://moderation:3001
PORT=3000
```
*Press `Ctrl+O`, `Enter`, then `Ctrl+X` to save and exit.*

### 3. Deploy via GitHub Actions (Recommended)
The project is configured with a GitHub Actions workflow (`deploy.yml`) that automates the deployment.

1. Ensure the following **GitHub Secrets** are set in your repository:
   - `VPS_IP`: Your VPS IP address.
   - `VPS_USER`: Your SSH username (e.g., `root` or `josh`).
   - `SSH_PRIVATE_KEY`: Your SSH private key.
   - `DOCKER_PASSWORD`: A GitHub Personal Access Token (PAT) with `read:packages` permissions.

2. Push your changes to the `main` branch. The workflow will:
   - Build new Docker images.
   - Push them to GitHub Container Registry (GHCR).
   - SSH into your VPS.
   - Pull the new images and restart the services.

### 4. Manual Deployment (Alternative)
If you prefer to deploy manually or for the first time:

1. Copy the `docker-compose.yml` and `Caddyfile` to your VPS:
   ```bash
   scp docker-compose.yml Caddyfile user@your-vps-ip:~/jeetsocial/
   ```

2. Run the following command on your VPS:
   ```bash
   docker compose pull
   docker compose up -d
   ```

## 🛡 Verifying Admin Access

Once deployed, you can verify your admin credentials:
1. Navigate to `https://yourdomain.com/admin`.
2. Enter the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you set in the VPS `.env` file.
3. You should now have access to the Moderation Dashboard with the new custom confirmation modal.

## ⚠️ Important Security Notes
- **HTTPS**: Caddy handles SSL automatically. Ensure your domain's DNS is correctly set up.
- **Passwords**: Never commit your `.env` file to version control. Use GitHub Secrets for sensitive data in CI/CD.
- **Backups**: The SQLite database is stored in a Docker volume named `sqlite_data`. Ensure you have a backup strategy for this volume.
