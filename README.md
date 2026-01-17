# 🚀 jeetSocial - Anonymous Kindness Social Network

"Just yeet kindness into the world."

jeetSocial is a modern, anonymous social network where users can share uplifting and supportive messages. Every post is assigned a random username (e.g., SillyGodzilla74).

## ✨ Features
- **Anonymous Messaging**: Randomly generated usernames for every post.
- **AI-Powered Moderation**: Advanced moderation using the `unbiased-toxic-roberta` model to maintain a kind environment.
- **Modern Toast System**: Friendly, animated notifications for all user interactions.
- **Real-time Feed**: New posts and likes appear instantly via WebSockets.
- **Kindness Points**: Upvote messages to spread more positivity.
- **Modern UI**: Dark theme with rainbow accents and smooth animations.
- **Production Ready**: Fully containerized with Docker Compose.

## 🛠 Tech Stack
- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + Vite + TypeScript
- **Database**: SQLite
- **Real-time**: WebSockets
- **Deployment**: Docker Compose

## 🚀 Quick Start (Production)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Deployment
**Option 1: Manual Docker Compose**
1. Clone the repository.
2. Create a `.env` file with your credentials.
3. Run `docker compose up -d`.

**Option 2: GitHub Actions (Automated)**
The repository includes a workflow to deploy to a VPS. You must set the following **GitHub Secrets**:
- `VPS_IP`, `VPS_USER`, `SSH_PRIVATE_KEY` (Server Access)
- `DOCKER_PASSWORD` (Registry Access)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (App Credentials)
- `SESSION_SECRET` (App Security)

## 👨‍💻 Development

### Using Docker (Recommended)
1. Run `docker compose -f docker-compose.local.yml up --build`.
2. Open `http://localhost:3000` in your browser.

### Running with Bun (Manual)
1. **Moderation Service**:
   ```bash
   cd moderation
   bun install
   bun run index.ts
   ```
2. **Main Server**:
   ```bash
   cd app/server
   bun install
   bun run index.ts
   ```
3. **Frontend**:
   ```bash
   cd app/client
   bun install
   bun run dev
   ```

## 🔒 Configuration
Copy `.env.example` to `.env` and adjust the variables.

### Admin Dashboard
Access the moderation dashboard at `/admin`. You will be redirected to a login page where you must enter the credentials defined in your environment variables.

### Admin Credentials
To access the moderation dashboard, you must set the following environment variables in your `.env` file or your deployment environment:

- `ADMIN_USERNAME`: The username for the admin dashboard (e.g., `admin`).
- `ADMIN_PASSWORD`: A secure password for the admin dashboard.

**Example `.env`:**
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

In a production Docker deployment, ensure these are either in the `.env` file referenced by `docker-compose.yml` or passed directly as environment variables.

## ⚖️ Moderation
The moderation service uses a two-tier approach:
1. **AI Inference**: Primary moderation via a dedicated Python service running the `unbiased-toxic-roberta` model.
2. **Keyword Fallback**: A secondary safety net that kicks in if the AI service is unavailable, ensuring continuous protection.

Rejection messages are designed to be friendly "Kindness Reminders" to encourage positive rephrasing rather than simple blocking.

## 📦 Architecture
- `app/server`: Hono backend with Bun-SQLite.
- `app/client`: React frontend with Vite.
- `moderation`: Independent moderation API.
- `docker-compose.yml`: Orchestrates everything.
