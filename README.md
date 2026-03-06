# RunTracker

A self-hosted fitness tracking and analysis platform with Strava integration. Import your activities, explore your running routes on an interactive map, track street coverage, plan workouts, and earn achievement badges. Inspired by ideas from various fitness and running apps. This project is intended for personal use only.

> **Note:** This application was almost entirely developed using AI-assisted spec-driven development, using [Claude Code](https://claude.ai/code) as the primary development tool.

---

## Features

### Dashboard
- Yearly and weekly distance charts broken down by sport type
- Recent activities feed with pace and heart rate summaries
- Quick stats overview and goals widget

### Activities
- Full activity list with filtering by sport type, date range, and tags
- Activity detail view with map, pace chart, heart rate chart, and lap splits
- GPS route visualization on an interactive map
- Side-by-side activity comparison
- GPX file import
- CSV export
- Tagging — create and assign custom tags to activities

### Profile & Stats
- Personal records (longest run, fastest pace, biggest elevation day, etc.)
- All-time stats and lifetime totals
- Configurable heart rate zone distribution (Karvonen, Garmin 5-zone, 7-zone Polarized, or fully custom)
- Yearly report with month-by-month breakdowns and infographic
- Time-of-day analysis — see when you tend to train
- Race predictor — estimate finish times for standard distances
- Race history — log and track your race results
- Running level — compare your times against age- and gender-graded standards (Beginner → Elite)

### Fitness & Fatigue
- Performance Management Chart (PMC) — CTL (fitness), ATL (fatigue), TSB (form)
- Overreaching risk and optimal form indicators
- Filterable by sport type

### Map Explorer
- All-routes map — every GPS track overlaid on a single interactive map
- **Tiles** — "visited squares" explorer (~1.2 km² grid tiles)
- **Streets** — Street coverage tracking; see which roads in your city you've run
- **Route Creator** — draw and save planned routes on the map

### Training
- Calendar-based workout planner with scheduled workouts
- Workout types: Easy, Tempo, Intervals, Long Run, Race, and more
- Planned vs actual comparison
- Batch import/export of training plans
- Drag-and-drop workout rescheduling
- Absence/rest day logging (Sick, Rest, Vacation, Injury, Other)
- Reusable workout template library

### Gear
- Equipment tracking with brand, type, purchase date, and notes
- Per-item mileage tracking with configurable starting distance offset
- Retirement distance threshold with automatic retirement flag
- Assign gear to activities

### Badges & Achievements
- 80+ achievement badges across distance, frequency, streaks, and exploration categories
- Automatic award on qualifying activity sync

### Community
- Follow other RunTracker users
- Community feed showing recent activity from followed users

### Strava Integration
- Full OAuth connect/disconnect flow
- Real-time webhook sync for new activities
- Historical import on first connect (resumes automatically after restart)
- Manual re-sync from Profile page

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Mapping | MapLibre GL, react-map-gl |
| Charts | Recharts |
| Drag & drop | dnd-kit |
| Data fetching | TanStack React Query, Axios |
| Backend | .NET 9, ASP.NET Core (Minimal APIs) |
| Architecture | Clean Architecture, CQRS with MediatR |
| ORM | Entity Framework Core 9 |
| Database | SQL Server 2022 |
| Auth | JWT Bearer tokens |
| Geospatial | NetTopologySuite |
| Containers | Docker, Docker Compose |

---

## Prerequisites

### Docker (recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Strava API credentials — see [Strava Setup](#strava-api-setup) below

### Local development
- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20+](https://nodejs.org/) with npm
- SQL Server 2022 (local instance or via Docker)
- Strava API credentials

---

## Strava API Setup

RunTracker syncs activities through the Strava API. You need to register a **free** Strava API application once to get a Client ID and Client Secret.

> **Note:** You only do this once. All users who later register on your RunTracker instance connect their own Strava accounts via OAuth — they do not need their own API app.

### 1. Create a Strava application

1. Log in to [strava.com](https://www.strava.com)
2. Go to **[https://www.strava.com/settings/api](https://www.strava.com/settings/api)**
3. Fill in the form:

| Field | Value |
|-------|-------|
| Application Name | `RunTracker` (or any name) |
| Category | `Visualizer` |
| Website | `http://localhost:5000` |
| Authorization Callback Domain | `localhost` (local dev) or your production domain |

4. Click **Create** (or **Update**)

### 2. Copy your credentials

After saving you will see:
- **Client ID** — a short numeric ID (e.g. `123456`)
- **Client Secret** — a long hex string

Keep these for the configuration steps below.

---

## Getting Started

### Option A — Docker (recommended)

```bash
# Linux / macOS
export STRAVA_CLIENT_ID=<your_client_id>
export STRAVA_CLIENT_SECRET=<your_client_secret>
docker compose up --build
```

```powershell
# Windows PowerShell
$env:STRAVA_CLIENT_ID = "<your_client_id>"
$env:STRAVA_CLIENT_SECRET = "<your_client_secret>"
docker compose up --build
```

Open **[http://localhost:5000](http://localhost:5000)** in your browser.

### Option B — Local development

**1. Configure the backend**

Create or edit `src/RunTracker.Web/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=RunTracker;User Id=sa;Password=yourpassword;TrustServerCertificate=true"
  },
  "Strava": {
    "ClientId": "<your_client_id>",
    "ClientSecret": "<your_client_secret>",
    "RedirectUri": "http://localhost:5122/api/auth/strava/callback"
  }
}
```

**2. Run the backend**

```bash
dotnet run --project src/RunTracker.Web
```

**3. Run the frontend (separate terminal)**

```bash
cd src/web-client
npm install
npm run dev
```

Open **[http://localhost:5122](http://localhost:5122)** in your browser.

> In development mode, the .NET backend automatically proxies all non-API requests to the Vite dev server (port 5173), giving you hot module replacement (HMR) without rebuilding.

---

## Registering Your Account

1. Open RunTracker in your browser
2. Click **Sign up**
3. Enter an email and password (minimum 4 characters)
4. Click **Create account** — you'll be taken to your Profile page
5. Click the orange **Connect Strava** button and authorize access
6. RunTracker will begin importing your historical activities in the background

---

## Test / Demo Accounts

The application seeds three demo accounts on first startup. These accounts contain pre-generated activities and do not require a real Strava connection.

| Name | Email | Password | Activities |
|------|-------|----------|------------|
| Alice Demo | `alice@demo.com` | `demo` | 5 |
| Bob Demo | `bob@demo.com` | `demo` | 20 |
| Charlie Demo | `charlie@demo.com` | `demo` | 50 |

---

## Project Structure

```
RunTracker/
├── src/
│   ├── RunTracker.Domain/          # Core entities and enums (no dependencies)
│   ├── RunTracker.Application/     # Business logic — CQRS commands & queries
│   ├── RunTracker.Infrastructure/  # EF Core, Strava service, OSM service, identity
│   ├── RunTracker.Web/             # ASP.NET Core API + Minimal API endpoints
│   │   └── wwwroot/                # Built React SPA (production)
│   └── web-client/                 # React + TypeScript frontend (Vite)
│       └── src/features/           # activities, dashboard, fitness, map, training, ...
├── docker-compose.yml
├── Dockerfile
├── SETUP.md                        # Focused first-time setup guide
└── README.md
```

**Architecture:** Clean Architecture with strict dependency direction:
`Domain ← Application ← Infrastructure ← Web`

---

## Configuration Reference

| Key | Description | Default (dev) |
|-----|-------------|---------------|
| `ConnectionStrings:DefaultConnection` | SQL Server connection string | `localhost` |
| `Strava:ClientId` | Strava API application Client ID | *(required)* |
| `Strava:ClientSecret` | Strava API application Client Secret | *(required)* |
| `Strava:RedirectUri` | OAuth callback URL | `http://localhost:5122/api/auth/strava/callback` |
| `Strava:WebhookVerifyToken` | Token used to verify Strava webhook calls | `runtracker-verify` |
| `Jwt:Secret` | JWT signing secret (min 32 chars) | *(required)* |
| `Jwt:Issuer` | JWT issuer | `RunTracker` |
| `Jwt:Audience` | JWT audience | `RunTracker` |
| `OpenRouteService:ApiKey` | Optional — used for route planning features | *(optional)* |

---

## Troubleshooting

**"Connect Strava" button is missing**
Make sure `Strava:ClientId` and `Strava:ClientSecret` are set and the app was restarted.

**Authorization callback domain mismatch**
The domain in your Strava API app settings must match where RunTracker is hosted. Use `localhost` for local development.

**Activities not appearing after connecting**
Click **Sync Activities** on the Profile page to manually trigger a sync. The initial historical import runs in the background and resumes automatically if the process restarts.

**Docker SQL Server fails to start**
Check that no other process is using port 1433, or change the port mapping in `docker-compose.yml`.

**Frontend shows blank page in development**
Make sure both the backend (`dotnet run`) and frontend (`npm run dev`) are running simultaneously.
