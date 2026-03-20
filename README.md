# 🐇 Rabbit Hole Explorer

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey?logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green?logo=mongodb)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7.0-red?logo=redis)](https://redis.io/)

**Rabbit Hole Explorer** is a high-performance, immersive knowledge discovery platform. It transforms static Wikipedia data into a dynamic, interactive "rabbit hole" where every click expands a sprawling web of connected ideas, powered by a custom DFS (Depth-First Search) layout engine.

> [!TIP]
> **Why "Rabbit Hole"?** Unlike traditional search, this tool is designed for *serendipitous discovery*. Start with a topic you know, and follow the neon-lit paths into the unknown.

---

## ✨ Key Features

- **🌀 Recursive Exploration**: Every node is an entry point. Click any article to pivot the graph and reveal new, contextually relevant connections.
- **🗺️ Narrative DFS Layout**: A custom layout algorithm ensures a clear left-to-right lineage. Your path is always visible, preventing "lost in hyperspace" syndrome.
- **⚡ Wikipedia Sync**: Fetches real-time summaries, high-res thumbnails, and categorical metadata directly from Wikipedia's REST and Action APIs.
- **🧪 Visual Excellence**:
    - **Neon Aesthetic**: A dark-mode, high-contrast theme with glowing nodes.
    - **Particle Physics**: Animated "energy flow" particles along the edges of your current exploration path.
    - **Responsive Canvas**: A custom-built 2D Canvas engine that handles hundreds of nodes with smooth lerp-based transitions.
- **💾 Account Persistence**:
    - **JWT-powered Auth**: Register and log in to save your sessions.
    - **History & Favourites**: Bookmark interesting "rabbit holes" and return to them anytime.
- **🚀 Performance-First**: Redis caching layer reduces API latency and Wikipedia rate-limiting issues.

---

## 🛠️ Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14, Tailwind CSS | UI, Routing, and Auth Context |
| **Visualization** | HTML5 Canvas 2D | Custom-built Graph Engine |
| **Backend** | Node.js, Express | RESTful API, JWT Auth |
| **Database** | MongoDB (Mongoose) | User profiles, Saved paths |
| **Cache** | Redis (ioredis) | API response caching |
| **Tooling** | Docker, Docker Compose | Containerization & Orchestration |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker & Docker Compose](https://www.docker.com/) (Recommended for local services)
- [MongoDB](https://www.mongodb.com/) & [Redis](https://redis.io/) (If running without Docker)

---

### Quick Start (The easiest way)

The project includes a root setup script that handles all dependencies and initial data.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Shivanshu-2205/rabbit-hole-explorer.git
   cd rabbit-hole-explorer
   ```

2. **Run the setup script**:
   ```bash
   npm run setup
   ```

3. **Spin up services with Docker**:
   ```bash
   docker-compose up -d
   ```

4. **Launch the app**:
   - Backend: `http://localhost:5000`
   - Frontend: `http://localhost:3000`

---

### Manual Setup

If you prefer to run services manually, configure your environment files:

#### Backend Settings (`/backend/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/rabbit-hole-explorer
REDIS_URL=redis://localhost:6379
ACCESS_TOKEN_SECRET=your_secret_here
REFRESH_TOKEN_SECRET=your_refresh_secret
```

#### Frontend Settings (`/frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 📂 Project Structure

```text
.
├── backend/            # Express.js API
│   ├── src/            # Controllers, Models, Routes
│   └── index.js        # Server Entry point
├── frontend/           # Next.js Application
│   ├── components/     # UI & Graph components
│   └── pages/          # Next.js Pages (Router)
├── docker-compose.yml  # Multi-container setup
└── package.json        # Unified root scripts
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with 💙 by Shivanshu and Garv.*
