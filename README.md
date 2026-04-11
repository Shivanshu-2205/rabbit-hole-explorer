# Rabbit Hole Explorer

> *Follow your curiosity across connected knowledge. Search any topic, click to dive deeper, and discover where your mind takes you.*

An interactive knowledge graph explorer that lets you navigate the web of human knowledge through Wikipedia and Wikidata — visualised as a living, animated graph. Each node is a real Wikipedia article. Each click expands the universe.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [How the Data Layer Works](#how-the-data-layer-works)
- [The Graph Engine](#the-graph-engine)
- [Backend API Reference](#backend-api-reference)
- [Authentication Flow](#authentication-flow)
- [Docker Setup](#docker-setup)
- [Common Issues & Fixes](#common-issues--fixes)
- [Roadmap](#roadmap)

---

## What It Does

Search any topic — a film, a person, a scientific concept, a historical event, a crime, anything with a Wikipedia article — and the app builds a live knowledge graph around it.

**Core experience:**
- Search "Blade Runner" → get a graph centered on the film with its cast, themes, and similar works
- Click "Harrison Ford" → the graph recenters on him, his notable works fan out to the right, Blade Runner stays visible as a dimmed ancestor to the left
- Click "Star Wars" → the chain grows: `Blade Runner ← Harrison Ford ← Star Wars`
- At any depth, the **right panel** shows angle-based suggestions: Cast & Crew, Themes & Genre, Similar Works, Production — curated by Wikidata's typed relationships, not random links

**What makes it different from Wikipedia:**
- Wikipedia is optimised for depth on one topic. This is optimised for lateral movement across topics
- The visual graph makes connections between ideas explicit and navigable
- The exploration path shows your intellectual journey — you can see how you got from Mitochondria to RNA Editing to the Rape of Europa
- Angle tabs give you structured ways to pivot that Wikipedia's "See also" section doesn't

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 + React 18 | UI framework with SSR control |
| Graph Rendering | HTML5 Canvas 2D | Animated node graph (no WebGL, no D3) |
| Styling | Inline styles + Tailwind CSS | Dark space aesthetic |
| Backend | Express.js + Node.js (ESM) | Auth API, favourites persistence |
| Database | MongoDB 7 via Mongoose | User accounts, saved paths |
| Cache | Redis 7 | Refresh token storage, session management |
| Knowledge Data | Wikipedia REST API + Action API | Article summaries, search, links |
| Entity Typing | Wikidata Action API | Typed relationships (cast, director, genre…) |
| Containerisation | Docker + Docker Compose | Full local dev environment |
| Validation | Zod | Request body validation on backend |
| Auth | JWT (access + refresh tokens) | Stateless auth with server-side revocation |
| Password Hashing | bcryptjs (12 rounds) | Secure credential storage |

---

## Architecture

```
Browser
  │
  ├─── Next.js Frontend (port 3000)
  │      │
  │      ├─── Wikipedia REST API    (summaries, thumbnails)
  │      ├─── Wikipedia Action API  (search, links, categories)
  │      └─── Wikidata Action API   (entity types, typed relationships)
  │
  └─── Express Backend (port 5000)
         │
         ├─── MongoDB (port 27017)   — users, favourites
         └─── Redis (port 6379)      — refresh tokens, session cache
```

**Key design decision:** Wikipedia and Wikidata API calls are made directly from the browser, not proxied through the backend. Both are public, CORS-enabled, and require no authentication. Introducing a backend proxy would add latency with no benefit. The backend only handles operations that require authentication — user accounts, saved exploration paths.

**Data flow for a search:**

1. User searches "Black Holes"
2. `wpSearch()` → Wikipedia Action API → finds canonical title "Black hole"
3. `wpSummary()` → Wikipedia REST API → fetches article data
4. `wpSearchMulti()` + `wpLinks()` → parallel calls for related content
5. `hydrateTitles()` → parallel Wikipedia summaries for candidate nodes
6. Graph state set in React → KnowledgeGraph canvas renders
7. `getTopicAngles()` fires → Wikidata entity lookup → angle tabs populate

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- At least 4GB RAM allocated to Docker (check Docker Desktop → Settings → Resources)
- Git

### Quick Start

```bash
git clone <your-repo-url>
cd rabbit-hole-explorer

# Copy the environment file and fill in your secrets
cp backend/.env.example backend/.env
# Edit backend/.env — set ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET

# Build and start everything
docker compose up --build
```

Wait for:
```
rhe-frontend  | ✓ Ready in 3.2s
```

Then open **http://localhost:3000**

### First-time vs subsequent starts

```bash
# First time or after adding npm packages — rebuild
docker compose up --build

# Every other time — just start
docker compose up

# Stop everything
docker compose down

# Stop and wipe database volumes (fresh start)
docker compose down -v
```

### If something breaks — full reset

```powershell
# Windows PowerShell
docker compose down
Remove-Item -Recurse -Force frontend\.next -ErrorAction SilentlyContinue
docker compose up --build
```

```bash
# macOS / Linux
docker compose down
rm -rf frontend/.next
docker compose up --build
```

> **Critical:** Always clear the `.next` cache when replacing frontend source files. Next.js caches compiled modules and will serve stale versions if you don't.

---

## Environment Variables

Create `backend/.env` by copying `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Backend server port (default: 5000) |
| `MONGODB_URI` | Yes | MongoDB connection string. In Docker: `mongodb://mongo:27017/rabbit-hole-explorer` |
| `REDIS_URL` | Yes | Redis connection string. In Docker: `redis://redis:6379` |
| `ACCESS_TOKEN_SECRET` | **Yes** | Random secret for signing access JWTs. Generate with `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRY` | Yes | Access token lifetime (default: `15m`) |
| `REFRESH_TOKEN_SECRET` | **Yes** | Random secret for signing refresh JWTs. Must differ from access secret |
| `REFRESH_TOKEN_EXPIRY` | Yes | Refresh token lifetime (default: `30d`) |
| `CORS_ORIGIN` | Yes | Frontend origin allowed by CORS (default: `http://localhost:3000`) |
| `NODE_ENV` | Yes | `development` or `production` |

> **Security:** Never commit `.env` to git. It is already in `.gitignore`. The two token secrets are the only values that matter for security — use strong random strings.

---

## Project Structure

```
rabbit-hole-explorer/
├── docker-compose.yml          # Dev orchestration — all 4 services
│
├── backend/
│   ├── Dockerfile.dev          # Dev image — nodemon hot reload
│   ├── .env.example            # Environment variable template
│   ├── index.js                # Entry point — connects DB, Redis, starts server
│   ├── app.js                  # Express app setup, middleware, routes
│   └── src/
│       ├── config/
│       │   └── redis.js        # Redis client setup with graceful fallback
│       ├── controllers/        # Request handlers
│       │   ├── auth.controller.js
│       │   ├── favourites.controller.js
│       │   ├── healthcheck.controller.js
│       │   └── history.controller.js
│       ├── middlewares/
│       │   ├── auth.middleware.js      # JWT verification
│       │   └── validator.middleware.js # Zod schema validation
│       ├── models/
│       │   ├── user.model.js           # User schema (bcrypt password hashing)
│       │   ├── favourite.model.js      # Saved exploration paths
│       │   └── history.model.js        # Search history
│       ├── repositories/       # Database access layer
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── favourites.routes.js
│       │   ├── healthcheck.routes.js
│       │   └── history.routes.js
│       ├── services/           # Business logic layer
│       ├── utils/
│       │   ├── api-error.js    # Custom error class
│       │   ├── api-response.js # Standard response wrapper
│       │   ├── async-handler.js# Async error wrapper for Express
│       │   ├── tokens.js       # JWT generation utilities
│       │   └── constants.js    # HTTP status codes
│       └── validators/         # Zod request schemas
│
└── frontend/
    ├── Dockerfile.dev          # Dev image — next dev hot reload
    ├── next.config.js          # Next.js config (standalone output, image domains)
    ├── public/
    │   └── rabbit_Hole.png     # App logo — used in navbar, favicon, empty state
    ├── pages/
    │   ├── _app.js             # AuthProvider wraps all pages
    │   └── index.js            # Main application — all graph state lives here
    ├── components/
    │   ├── graph/
    │   │   ├── KnowledgeGraph.js  # Canvas renderer — DFS layout, draw loop
    │   │   ├── ActiveNodeCard.js  # Bottom card — shows active node detail
    │   │   └── NodeTooltip.js     # Hover tooltip
    │   └── ui/
    │       ├── Navbar.js          # Top bar — search, nav, auth
    │       ├── LeftSidebar.js     # Exploration path + graph stats
    │       ├── RightPanel.js      # Angle tabs + suggestion cards
    │       ├── SearchBar.js       # Search input with loading state
    │       ├── FavouritesView.js  # Saved paths grid
    │       ├── AuthModal.js       # Login / register modal
    │       └── ProfileDropdown.js # Logged-in user menu
    ├── contexts/
    │   └── AuthContext.js      # Global auth state — token, user, isLoggedIn
    └── utils/
        ├── api.js              # All data fetching — Wikipedia, Wikidata, backend
        └── graphLayout.js      # Spherical layout utilities (legacy, unused)
```

---

## How the Data Layer Works

All knowledge graph data lives in `frontend/utils/api.js`. No other file talks to external APIs.

### Wikipedia APIs Used

**REST API** (`en.wikipedia.org/api/rest_v1`) — used for rich article data:
- `GET /page/summary/{title}` → article summary with thumbnail, extract, URLs

**Action API** (`en.wikipedia.org/w/api.php`) — used for search and graph traversal:
- `action=query&list=search` → fuzzy title search
- `action=query&prop=links` → inline page links (for graph expansion)
- `action=query&prop=categories` → page categories

### Wikidata API Used

**Action API** (`www.wikidata.org/w/api.php`) — used for entity type detection and typed relationships:
- `action=wbgetentities&sites=enwiki` → get entity for a Wikipedia title
- `action=wbgetentities&ids=Q123` → get entity by QID (for batch title resolution)

### Entity Type Detection

When you click a node, the right panel calls `getTopicAngles()`. It:

1. Fetches the Wikidata entity for the Wikipedia article
2. Reads the `P31` (instance of) claims to determine what type of thing it is
3. Maps the QIDs to entity types using hardcoded sets:

| Entity Type | Example P31 QIDs | Angle Tabs Generated |
|---|---|---|
| `FILM_SHOW` | Q11424 (film), Q5398426 (TV series) | Cast & Crew, Characters, Themes & Genre, Similar Works |
| `PERSON` | Q5 (human) | Notable Works, Life & Context, Field & Work, Connected People |
| `FICTIONAL_PERSON` | Q15632617 (fictional human) | Appears In, Portrayed By, Related Characters |
| `CRIME_EVENT` | Q149086 (homicide), Q3030248 (rape) | The Incident, People Involved, Legal Outcome, Context |
| `PLACE` | Q515 (city), Q6256 (country) | Geography, History, Notable People, Culture & Life |
| `TECHNOLOGY` | Q7397 (software), Q9174 (OS) | How It Works, History, Alternatives, Impact & Use |
| `HISTORICAL_EVENT` | Q198 (war), Q178561 (battle) | What Happened, Key People, Causes, Aftermath |
| `ORGANIZATION` | Q4830453 (business), Q3918 (university) | Key People, History, Industry |
| `MUSIC` | Q482994 (album), Q215380 (band) | Artists, Genre & Style, Discography, Era |
| `CONCEPT` | Q151885 (concept), Q16722960 (theory) | The Idea, Origins, Applications, Debate |

### Rate Limiting

Wikipedia rate-limits by IP. The app uses `fetchWithRetry()` which:
- Detects HTTP 429 responses
- Reads the `Retry-After` header (capped at 10 seconds)
- Waits and retries up to 2 times before giving up

If you see "Could not fetch data" during development — especially after heavy testing — your IP may be rate-limited for up to 20 minutes. This is not a code error.

---

## The Graph Engine

`KnowledgeGraph.js` renders everything on an HTML5 Canvas using `requestAnimationFrame`. No DOM elements, no SVG, no D3.

### Why Canvas

DOM-based graph rendering breaks down above ~100 nodes due to layout thrashing. Canvas renders all nodes as pixels in a single draw call per frame — no layout calculations, no style recalculation, no per-element event listeners.

### DFS Layout

The layout follows a Depth-First Search visual metaphor:

```
[Great-grandparent]  [Grandparent]  [Parent]    [CURRENT NODE]    child1
   25% opacity          45% opacity   75% opacity    100%       →   child2
   58% size             72% size      88% size                      child3
                                                                     child4
```

- **Current node** — always at world coordinate (0, 0), full size, full opacity
- **Children** — semicircle to the right, radius 240 world units, arc from -100° to +100°
- **Ancestors** — chain to the left at fixed positions (-340, -640, -900), progressively dimmed and scaled down
- **Maximum 3 ancestors** visible at once — oldest drops off as you go deeper

### Animation

All positions use lerp-based animation: each frame, actual position moves 6.5% toward target position. This creates natural ease-out motion — fast at first, slowing as it approaches the target.

```
pos[id] = lerp(pos[id], targetPos[id], 0.065)
```

Camera pan and zoom follow the same pattern with `ox`, `oy`, `scale`.

### Hit Testing

Mouse clicks use axis-aligned bounding box (AABB) testing against each node's card rectangle, accounting for zoom scale and ancestor scale factors.

---

## Backend API Reference

Base URL: `http://localhost:5000/api`

### Auth Routes

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | None | `{ email, password }` | Create account |
| `POST` | `/auth/login` | None | `{ email, password }` | Login, returns access + refresh token |
| `POST` | `/auth/refresh` | None | `{ refreshToken }` | Get new access token |
| `POST` | `/auth/logout` | Bearer | — | Invalidate refresh token |
| `GET` | `/auth/me` | Bearer | — | Get current user profile |

### Favourites Routes

All require `Authorization: Bearer <access_token>` header.

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/favourites` | — | Get all saved paths for current user |
| `POST` | `/favourites` | `{ title, path[] }` | Save current exploration path |
| `PATCH` | `/favourites/:id` | `{ customName }` | Rename a saved path |
| `DELETE` | `/favourites/:id` | — | Delete a saved path |

### Other Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthcheck` | Service health status |

### Response Format

All responses follow a standard wrapper:

```json
{
  "statusCode": 200,
  "message": "Favourites fetched",
  "data": { ... }
}
```

Errors return the same shape with an appropriate status code and error message.

---

## Authentication Flow

The app uses a dual-token pattern:

```
Login
  │
  ├── access token  (15 min expiry)  → sent as Authorization: Bearer header
  └── refresh token (30 day expiry)  → stored in MongoDB on user document
                                        sent by client to /auth/refresh when
                                        access token expires

Logout
  └── refresh token deleted from database
      → even if token hasn't expired, server rejects it
```

**Why two tokens:**
- Short-lived access token limits exposure window if stolen
- Long-lived refresh token means users don't log in every 15 minutes
- Server-side refresh token storage enables true logout (unlike pure JWTs)

**Passwords** are hashed with bcryptjs at 12 rounds before storage. The `password` field has `select: false` so it's never returned in queries by default.

---

## Docker Setup

### Services

| Container | Image | Port | Purpose |
|---|---|---|---|
| `rhe-frontend` | Node 20 Alpine | 3000 | Next.js dev server |
| `rhe-backend` | Node 20 Alpine | 5000 | Express API with nodemon |
| `rhe-mongo` | mongo:7 | 27017 | MongoDB database |
| `rhe-redis` | redis:7-alpine | 6379 | Redis cache |

### Startup Order

```
mongo (healthy) ─┐
                  ├─→ backend (starts) ─→ frontend (starts)
redis (healthy) ─┘
```

The backend waits for both mongo and redis to pass their healthchecks before starting. This prevents Mongoose connection failures on first boot.

### Hot Reload

Both frontend and backend support hot reload without rebuilding:

- **Backend** — nodemon watches source files, restarts on change
- **Frontend** — Next.js dev server with `WATCHPACK_POLLING=true` (required on Windows/WSL for file change detection inside Docker)

Source code is volume-mounted from the host. Node modules are kept in isolated anonymous volumes so the host's `node_modules` (potentially Windows-compiled) don't override the container's Linux-compiled ones.

### When to rebuild

Run `docker compose up --build` when:
- Adding a new npm package to either frontend or backend
- Changing a `Dockerfile.dev`
- Setting up for the first time

Plain `docker compose up` for everything else.

---

## Common Issues & Fixes

### "Could not fetch data. Check your connection."

**Most likely: Wikipedia rate limiting (HTTP 429)**

Open browser DevTools → Network tab → look for a Wikipedia request with status 429 and a `Retry-After` header. If present, wait the specified time (up to 20 minutes during heavy development) and try again.

If not rate limiting: check that Docker has internet access and your machine's DNS resolves `en.wikipedia.org`.

### "getTopicAngles is not a function"

**Cause:** `RightPanel.js` is a newer version that imports `getTopicAngles`, but `api.js` is an older version that doesn't export it. Files are mismatched.

**Fix:** Ensure both files are the same version. Then:
```powershell
docker compose down
Remove-Item -Recurse -Force frontend\.next
docker compose up
```

### Blank canvas / disconnected nodes

**Cause:** Clicking a node from the right panel's angle tabs adds a node that doesn't yet exist in the graph state. The DFS layout can't find it.

**Fix:** `handlePanelNodeClick` in `index.js` injects the node and a connecting edge into the graph before navigating to it. Ensure you're using the current `index.js`.

### Hot reload not working on Windows

**Cause:** Windows file system events don't propagate correctly into Docker containers by default.

**Fix:** `WATCHPACK_POLLING: "true"` is already set in `docker-compose.yml`. If still not working, try saving the file twice or touching it from inside the container.

### Docker using too much RAM

**Cause:** Docker Desktop defaults to using most available RAM. Other applications compete for the remainder.

**Fix:** Docker Desktop → Settings → Resources → set Memory to 4–6GB. Apply & Restart.

### Cannot connect to MongoDB / Redis

**Cause:** Backend started before healthchecks passed, or volumes are corrupted.

**Fix:**
```bash
docker compose down -v   # removes volumes — database will be empty after this
docker compose up --build
```

---

## Roadmap

**Immediate (high impact, low effort)**
- [ ] Backend caching routes (`GET /api/topic/:title`, `GET /api/angles/:title`) using Redis with 24h TTL — would eliminate rate limiting and reduce repeat search latency from 5-8s to near-instant
- [ ] Better disambiguation handling — detect "List of..." and "(disambiguation)" titles and re-search automatically
- [ ] Graph pruning — remove nodes more than K steps from current path to prevent unbounded memory growth in long sessions

**Short term**
- [ ] Shareable path URLs (`/explore?path=Black_hole,Mitochondrion,RNA_editing`) — reconstruct any exploration from a URL
- [ ] Search history persisted per user
- [ ] Mobile touch support (pan, pinch-to-zoom, tap) on the canvas

**Medium term**
- [ ] Frontend error boundaries to prevent full-page crashes from canvas errors
- [ ] ConceptNet integration for abstract concept topics (philosophy, mathematics) where Wikidata has sparse typed relationships
- [ ] Frame rate monitoring — detect when draw loop drops below 30fps and reduce visual effects accordingly

**Deployment**
- [ ] Railway or Render for backend, Vercel for frontend, MongoDB Atlas, Redis Cloud free tier
- [ ] Production docker-compose using existing `backend/Dockerfile` and `frontend/Dockerfile` (multi-stage builds already written)
- [ ] Open Graph meta tags for shareable paths

---

## License

MIT

---

*Built with curiosity. Powered by Wikipedia, Wikidata, and the belief that knowledge should be explorable, not just searchable.*

BY Shivanshu and Garv