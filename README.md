# NexusChat 💬

A production-grade real-time team chat application built and deployed using modern DevOps practices.

![Stack](https://img.shields.io/badge/React-18-blue) ![Stack](https://img.shields.io/badge/Node.js-18-green) ![Stack](https://img.shields.io/badge/Docker-Compose-blue) ![Stack](https://img.shields.io/badge/Kubernetes-EKS-orange) ![Stack](https://img.shields.io/badge/CI/CD-GitHub_Actions-black) ![Stack](https://img.shields.io/badge/Monitoring-Prometheus_Grafana-red)

## Architecture
```
Browser
  │
  ├──► :80/3000  frontend        (React — served by nginx)
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
| Image Registry | AWS ECR |
| Orchestration | Kubernetes (AWS EKS) |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus, Grafana (kube-prometheus-stack) |

## Features

- JWT authentication (register/login)
- Create and join chat rooms
- Real-time messaging via WebSockets
- Online presence indicators
- Typing indicators
- Persistent message history (PostgreSQL)
- Session caching (Redis)

## Running Locally with Docker

### Prerequisites
- Docker Desktop

### Start the app
```bash
git clone https://github.com/badmancarteer/nexuschat.git
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

### Prerequisites
- AWS CLI configured
- kubectl installed
- eksctl installed

### Create EKS cluster
```bash
eksctl create cluster \
  --name nexuschat \
  --region us-east-1 \
  --nodegroup-name nexuschat-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed
```

### Create ECR repositories and push images
```bash
aws ecr create-repository --repository-name nexuschat-api-service --region us-east-1
aws ecr create-repository --repository-name nexuschat-chat-service --region us-east-1
aws ecr create-repository --repository-name nexuschat-frontend --region us-east-1

aws ecr get-login-password --region us-east-1 | docker login --username AWS \
  --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-api-service:latest ./api-service
docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-chat-service:latest ./chat-service
docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-frontend:latest ./frontend

docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-api-service:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-chat-service:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/nexuschat-frontend:latest
```

### Deploy to EKS
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/api-service/
kubectl apply -f k8s/chat-service/
kubectl apply -f k8s/frontend/
```

### Verify deployment
```bash
kubectl get pods -n nexuschat
kubectl get service frontend -n nexuschat
```

## CI/CD Pipeline (GitHub Actions)

Every push to `main` automatically:

1. Builds Docker images for all three services
2. Pushes images to AWS ECR
3. Updates kubeconfig for EKS
4. Applies Kubernetes manifests
5. Restarts deployments to pick up new images
6. Verifies rollout success

### Required GitHub Secrets
| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_ACCOUNT_ID` | AWS account ID |

## Monitoring

Monitoring is handled by the **kube-prometheus-stack** Helm chart, which deploys:
- **Prometheus** — scrapes and stores metrics from all pods and nodes
- **Grafana** — dashboards and visualizations
- **AlertManager** — alerting on critical conditions
- **node-exporter** — CPU, memory, disk metrics from EC2 nodes
- **kube-state-metrics** — Kubernetes object metrics

### Install monitoring stack
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

### Access Grafana
```bash
kubectl port-forward service/monitoring-grafana 3030:80 -n monitoring
```
Open http://localhost:3030 (admin / see secret)

### Key Dashboards
| Dashboard | What it shows |
|---|---|
| Kubernetes / Compute Resources / Node | CPU & memory per EC2 node |
| Kubernetes / Compute Resources / Workload | Resource usage per deployment |
| Kubernetes / Compute Resources / Pod | Per-pod CPU and memory |
| Kubernetes / Networking / Cluster | Network traffic across cluster |

## Project Structure
```
nexuschat/
├── frontend/                 # React app
│   ├── src/
│   │   ├── pages/            # AuthPage, ChatPage
│   │   ├── context/          # Auth context (JWT)
│   │   └── hooks/            # Socket.io hook
│   ├── nginx.conf            # Production nginx config with API proxy
│   └── Dockerfile            # Multi-stage build
├── api-service/              # REST API
│   ├── src/index.js          # Express routes, auth, DB init
│   └── Dockerfile
├── chat-service/             # WebSocket server
│   ├── src/index.js          # Socket.io events, presence tracking
│   └── Dockerfile
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres/
│   ├── redis/
│   ├── api-service/
│   ├── chat-service/
│   └── frontend/
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
└── docker-compose.yml        # Local development
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