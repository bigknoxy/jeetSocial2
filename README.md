# 🚀 jeetSocial - Anonymous Kindness Social Network

"Just yeet kindness into the world."

jeetSocial is a modern, anonymous social network where users can share uplifting and supportive messages. Every post is assigned a random username (e.g., SillyGodzilla74).

## ✨ Features
- **Anonymous Messaging**: Randomly generated usernames for every post.
- **Kindness Focused**: Integrated moderation service rejects unkind content.
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
1. Clone the repository.
2. Run `docker-compose up -d`.
3. Open `http://localhost:3000` in your browser.

## 👨‍💻 Development

### Prerequisites
- [Bun](https://bun.sh/)

### Running Locally
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

## ⚖️ Moderation
The moderation service is a separate microservice. It currently uses keyword filtering but is designed to be swappable with AI-based moderation.

## 📦 Architecture
- `app/server`: Hono backend with Bun-SQLite.
- `app/client`: React frontend with Vite.
- `moderation`: Independent moderation API.
- `docker-compose.yml`: Orchestrates everything.
