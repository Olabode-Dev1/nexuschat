# NexusChat 💬

A production-grade real-time team chat application, built and deployed as a DevOps learning project.

![Stack](https://img.shields.io/badge/React-18-blue) ![Stack](https://img.shields.io/badge/Node.js-18-green) ![Stack](https://img.shields.io/badge/Docker-Compose-blue) ![Stack](https://img.shields.io/badge/Kubernetes-EKS-orange)

## Architecture
```
Browser
  │
  ├──► :3000  frontend        (React — served by nginx)
  │              │
  │              ├── HTTP ──► :3001  api-service    (Express REST API)
  │              └── WS ───► :3002  chat-service   (Socket.io)
  │                                      │
  │                          ┌───────────┴───────────┐
  │                       :5432                    :6379
  │                      postgres                  redis
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Socket.io-client, Axios |
| API Service | Node.js, Express, JWT, bcrypt |
| Chat Service | Node.js, Socket.io, WebSockets |
| Database | PostgreSQL 15 |
| Cache / Presence | Redis 7 |
| Containerization | Docker, Docker Compose |
| Orchestration | Kubernetes (AWS EKS) |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus, Grafana |

## Features

- JWT authentication (register/login)
- Create and join chat rooms
- Real-time messaging via WebSockets
- Online presence indicators
- Typing indicators
- Persistent message history

## Running Locally with Docker

### Prerequisites
- Docker Desktop

### Start the app
```bash
git clone https://github.com/yourusername/nexuschat.git
cd nexuschat
docker compose up --build
```

Open http://localhost:3000

### Services
| Service | Port |
|---|---|
| Frontend | http://localhost:3000 |
| API Service | http://localhost:3001 |
| Chat Service | http://localhost:3002 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Kubernetes Deployment (AWS EKS)

Coming soon — manifests in `/k8s`

## CI/CD Pipeline (GitHub Actions)

Coming soon — workflow in `/.github/workflows`

## Monitoring

Coming soon — Prometheus + Grafana dashboards

## Project Structure
```
nexuschat/
├── frontend/                 # React app
│   ├── src/
│   │   ├── pages/            # AuthPage, ChatPage
│   │   ├── context/          # Auth context
│   │   └── hooks/            # Socket hook
│   ├── nginx.conf            # Production nginx config
│   └── Dockerfile
├── api-service/              # REST API
│   ├── src/index.js
│   └── Dockerfile
├── chat-service/             # WebSocket server
│   ├── src/index.js
│   └── Dockerfile
├── k8s/                      # Kubernetes manifests (coming soon)
├── .github/workflows/        # CI/CD pipelines (coming soon)
└── docker-compose.yml
```

## Environment Variables

### api-service & chat-service
| Variable | Description | Default |
|---|---|---|
| DB_HOST | PostgreSQL host | postgres |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | nexuschat |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | postgres |
| REDIS_URL | Redis connection URL | redis://redis:6379 |
| JWT_SECRET | JWT signing secret | nexussecret |

### frontend
| Variable | Description |
|---|---|
| REACT_APP_API_URL | API service URL |
| REACT_APP_CHAT_URL | Chat service WebSocket URL |