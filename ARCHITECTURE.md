# RunTracker — Architecture

## Overview

RunTracker follows the **Jason Taylor Clean Architecture** template for the backend, paired with a React/TypeScript SPA frontend. The architecture enforces strict dependency flow: outer layers depend on inner layers, never the reverse.

```
Domain ← Application ← Infrastructure
                    ← Web (API)
```

---

## Layer Responsibilities

### Domain (`RunTracker.Domain`)
Pure business entities and enums. No external dependencies except `NetTopologySuite` for geospatial types.

- **Entities**: `User`, `Activity`, `ActivityStream`, `City`, `Street`, `StreetNode`, `UserStreetNode`, `UserCityProgress`, `PersonalRecord`, `ScheduledWorkout`, `UserTile`, `UserBadge`, `BadgeDefinition`, `Gear`, `Tag`, `ActivityTag`, `UserFollow`, `PlannedRoute`, `AbsenceDay`
- **Enums**: `ActivitySource`, `SportType`, `RecordType`, `WorkoutType`, `GearType`, `Gender`, `HrZoneAlgorithm`, `AbsenceType`
- `User` extends ASP.NET Identity's `IdentityUser`

### Application (`RunTracker.Application`)
Business logic via CQRS (MediatR). No EF Core or infrastructure code — only interfaces.

- **Pattern**: Each feature folder contains queries/commands with their handlers and DTOs
- **Validation**: FluentValidation validators alongside commands
- **Mapping**: Mapster for DTO projection (no AutoMapper profiles)
- **Interfaces**: `IApplicationDbContext`, `IStravaService`, `IStreetMatchingService`, `IOsmService`, `IIdentityService`, `ITileService`, `IBadgeService`, `IFileStorageService`, `ICurrentUserService`

```
Application/
├── Activities/
│   └── Queries/       (GetActivityListQuery, GetActivityDetailQuery, GetActivitiesExportQuery)
├── Statistics/
│   └── Queries/       (GetYearlyStatsQuery, GetWeeklyStatsQuery, GetAllTimeStatsQuery,
│                        GetTrainingLoadQuery, GetTimeOfDayStatsQuery, GetRunningLevelQuery, ...)
├── Streets/
│   └── Queries/       (GetCityListQuery, GetCityDetailQuery, GetCityStreetsQuery, GetCityGeoJsonQuery)
├── Training/
│   ├── Commands/      (Create, Update, Delete, Duplicate, BatchImport)
│   └── Queries/       (GetScheduledWorkoutsQuery)
├── Badges/
│   └── Queries/       (GetBadgesQuery)
├── Tags/
│   └── (TagsHandlers — CRUD for tags and activity assignments)
├── Gear/
│   └── (GearHandlers — CRUD, mileage tracking)
├── Social/
│   └── (SocialHandlers — follow/unfollow, community feed)
├── Routes/
│   └── (PlannedRouteHandlers — save/list/delete planned routes)
└── Absence/
    ├── Commands/      (CreateAbsence, UpdateAbsence, DeleteAbsence)
    └── Queries/       (GetAbsencesQuery)
```

### Infrastructure (`RunTracker.Infrastructure`)
Implements all interfaces. Contains EF Core, external API clients, JWT, Identity.

- **DbContext**: `AppDbContext` — EF Core 9 with SQL Server + spatial extension
- **Migrations**: Fluent configuration per entity in `Configurations/`
- **Services**: `StravaService`, `OsmService`, `StreetMatchingService`, `IdentityService`, `PersonalRecordService`, `TileService`, `BadgeService`
- **Background**: `StravaSyncBackgroundService` (Channel-based hosted service), `StravaHistoricalSyncStartupService` (resumes interrupted historical syncs on startup)

### Web (`RunTracker.Web`)
ASP.NET Core Minimal API. Thin layer — no business logic.

- **Endpoints**: Grouped by feature (`ActivityEndpoints`, `StreetEndpoints`, `TrainingEndpoints`, `AuthEndpoints`, `StatisticsEndpoints`, `BadgeEndpoints`, `TagEndpoints`, `SocialEndpoints`, `WebhookEndpoints`, `AbsenceEndpoints`)
- **Auth**: JWT Bearer middleware; endpoints use `.RequireAuthorization()`
- **SPA serving**: Serves built React app from `wwwroot/`
- **OpenAPI**: `Microsoft.AspNetCore.OpenApi`

### Web Client (`src/web-client`)
React 18 + TypeScript SPA, built with Vite. Served by the .NET host in production.

```
web-client/src/
├── api/           (Axios client, typed API wrappers)
├── components/    (Navbar, StatCard, LoadingSpinner, ActivityFilters, TagPicker, StravaSyncDialog)
├── contexts/      (ActivityTypeFilterContext)
├── features/
│   ├── activities/   (list, detail, comparison, GPX import, CSV export)
│   ├── badges/       (badges grid)
│   ├── dashboard/    (summary charts, recent feed, goals widget)
│   ├── fitness/      (Performance Management Chart — CTL/ATL/TSB)
│   ├── gear/         (equipment list and mileage)
│   ├── map/          (all-routes map, route creator)
│   ├── profile/      (stats, HR zones, running level card, fitness benchmark)
│   ├── social/       (community feed, follow/unfollow)
│   ├── stats/        (yearly report, race predictor, race history, running level, time-of-day)
│   ├── streets/      (city list, city detail with street coverage map)
│   ├── tiles/        (visited tiles map)
│   └── training/     (calendar, workout planner, absence days, templates, import/export)
├── hooks/         (useAuth.tsx, useTheme.tsx, useQueries.ts — TanStack Query hooks)
└── types/         (index.ts — all TypeScript types)
```

---

## Data Model

```
User ──< Activity ──< ActivityStream
     │            └── GearId (FK → Gear)
     │            └──< ActivityTag >── Tag
     ├──< PersonalRecord
     ├──< ScheduledWorkout
     ├──< AbsenceDay
     ├──< UserCityProgress >── City ──< Street ──< StreetNode
     │                                                 └──< UserStreetNode (junction)
     ├──< UserTile
     ├──< UserBadge >── BadgeDefinition
     ├──< Gear
     ├──< Tag
     ├──< PlannedRoute
     └──< UserFollow (self-referential: Follower/Followee)
```

All geospatial data uses **SRID 4326 (WGS84)**:
- `City.Boundary` → `MultiPolygon`
- `Street.Geometry` → `LineString`
- `StreetNode.Location` → `Point`
- `ActivityStream.Location` → `Point`

---

## NuGet Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `NetTopologySuite` | 2.6.0 | Geospatial types (Point, LineString, MultiPolygon) |
| `Microsoft.AspNetCore.Identity.EntityFrameworkCore` | 9.* | User management, password hashing, roles |
| `MediatR` | 14.0.0 | CQRS mediator — dispatches queries and commands |
| `FluentValidation` | 12.1.1 | Input validation with fluent API |
| `FluentValidation.DependencyInjectionExtensions` | 12.1.1 | Auto-register validators from assembly |
| `Mapster` | 7.4.0 | Object-to-object mapping for DTO projection |
| `Microsoft.EntityFrameworkCore` | 9.* | ORM base |
| `Microsoft.EntityFrameworkCore.SqlServer` | 9.* | SQL Server provider |
| `Microsoft.EntityFrameworkCore.SqlServer.NetTopologySuite` | 9.* | Spatial column support in SQL Server |
| `Microsoft.EntityFrameworkCore.Tools` | 9.* | EF CLI tools (migrations) |
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 9.* | JWT validation middleware |
| `Microsoft.AspNetCore.OpenApi` | 9.0.12 | OpenAPI/Swagger spec generation |
| `Microsoft.AspNetCore.SpaServices.Extensions` | 9.* | SPA proxy for dev mode |

---

## npm Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.28.0 | Client-side routing |
| `@tanstack/react-query` | ^5.62.0 | Server state, caching, background refetch |
| `axios` | ^1.7.9 | HTTP client with interceptors (JWT injection) |
| `maplibre-gl` | ^4.7.0 | Open-source WebGL map renderer |
| `react-map-gl` | ^7.1.7 | React bindings for MapLibre GL |
| `@mapbox/polyline` | ^1.2.1 | Encode/decode Strava-style polylines |
| `recharts` | ^2.13.3 | Composable chart components |
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop primitives |
| `@dnd-kit/utilities` | ^3.2.2 | dnd-kit utility helpers |
| `typescript` | ~5.6.0 | Static typing |
| `vite` | ^6.0.0 | Fast build tool and dev server |
| `tailwindcss` | ^3.4.16 | Utility-first CSS |
| `postcss` + `autoprefixer` | — | CSS processing pipeline |

---

## Implemented Features

### Authentication & Users
- JWT-based registration and login
- ASP.NET Identity for password hashing and user management
- Extended user profile: `DisplayName`, `Bio`, `WeightKg`, `HeightCm`, `Gender`, `DateOfBirth`, `MaxHeartRate`, `RestingHeartRate`, `HrZoneAlgorithm`, custom HR zone upper bounds
- `GET /api/auth/me` returns full profile; `PUT /api/auth/profile` for updates
- BMI computed client-side; `MaxHeartRate` + algorithm used for HR zone calculations

### Strava Integration
- OAuth 2.0 connect flow (`/api/auth/strava/connect` → callback)
- Token refresh on expiry
- Background sync service queues sync jobs via `Channel<T>`
- `StravaHistoricalSyncStartupService` resumes interrupted historical imports on startup
- `POST /api/auth/strava/sync` triggers manual sync
- Webhook endpoint for real-time activity push (`POST /api/webhook`)

### Activity Tracking
- Paginated activity list with filters (sport type, date range, tags)
- Activity detail with full GPS stream data, elevation profile, lap splits
- CSV export (`GET /api/activities/export`)
- GPX import — upload a `.gpx` file to create an activity without Strava
- Side-by-side activity comparison (`/activities/compare`)
- Tags — create custom labels and assign them to activities

### Statistics
- **Yearly stats**: Monthly breakdown of distance, time, elevation
- **Weekly stats**: Per-week breakdown for a given year
- **All-time stats**: Totals across all activities
- **Personal records**: Fastest 1K/5K/10K/Half/Marathon, longest run
- **Pace trend**: Monthly/weekly average pace over time
- **Time of day**: Heatmap/histogram of training times across the day
- **Race history**: Log and review race results
- **Race predictor**: Riegel-formula finish time estimates for standard distances
- **Running level**: Age- and gender-graded comparison against Beginner/Novice/Intermediate/Advanced/Elite/WR standards for 5K, 10K, Half, Marathon

### Fitness & Fatigue (Performance Management Chart)
- Chronic Training Load (CTL / fitness), Acute Training Load (ATL / fatigue), Training Stress Balance (TSB / form)
- TRIMP-based stress score computed per activity
- Form zones: Optimal (TSB 5–25), Freshness (>25), Productive/Fatigued (<-10), Overreaching Risk (<-30)
- Filterable by sport type

### Heart Rate Zones
- Multiple zone algorithms: PercentMax, Karvonen (HRR), Garmin 5-zone, 7-zone Polarized, Custom
- Custom zones defined as five upper-bpm thresholds stored in user profile
- Zone distribution charts on activity detail and profile pages

### Street Coverage
- Import cities from OpenStreetMap via Overpass API
- Store street network as geospatial `LineString` geometries
- Match activity GPS points to street nodes within 25m radius
- 90% node coverage threshold marks a street complete
- Per-city completion percentage tracked in `UserCityProgress`
- GeoJSON export for map visualization
- Reprocess all activities against street network on demand

### Training Schedule & Calendar
- Calendar-based workout planner at `/training` and `/calendar`
- CRUD for scheduled workouts with workout types (Easy, Tempo, Long, Intervals, Race, etc.)
- Planned targets: distance, duration, target pace (mm:ss/km), target HR zone (1–5)
- Drag-and-drop rescheduling (dnd-kit)
- Duplicate workout to another date
- Batch CSV import/export of training plans
- Reusable workout template library
- **Workout vs Actual Comparison**: auto-matches longest run on same date; compares distance, duration, pace, HR zone (color-coded)
- **Absence days**: log rest days with type (Sick, Rest, Vacation, Injury, Other) and notes; shown on calendar

### Tile Explorer
- Slippy-map zoom-15 tiles (~1.2km²) marked visited when any activity GPS point falls inside
- `UserTile` (UserId, TileX, TileY) table; tile computed via Web Mercator formula
- Computed during Strava sync; `POST /api/tiles/reprocess` for full backfill
- Frontend `/tiles`: MapLibre fill layer + visited count and area estimate

### Badges / Achievements
- Badge definitions stored in `BadgeDefinition` table (seeded on startup)
- `UserBadge` (UserId, BadgeType) table; composite PK prevents duplicates
- Evaluated automatically after each sync via `BadgeService`
- Shown on `/badges` page and as emoji grid on Profile

### Gear Tracking
- Equipment items with `Name`, `Brand`, `GearType`, `PurchaseDate`, `Notes`
- `StartingDistanceM` offset for pre-existing mileage
- `RetirementDistanceM` threshold — gear marked retired automatically when exceeded
- Activities linked to gear via foreign key; total distance computed from linked activities + starting offset

### Route Creator
- Draw waypoints on an interactive map (`/routes/create`)
- Save named planned routes with encoded polyline and total distance
- `PlannedRoute` entity stored per user

### Community / Social
- Follow and unfollow other registered users
- `UserFollow` (FollowerId, FolloweeId) junction with composite PK
- Community page (`/community`) shows recent activities from followed users

### Map Explorer
- All activity routes rendered on a single interactive map (`/map`)
- Per-city street network with completed/incomplete coloring

---

## Key Patterns & Conventions

### Adding a New Feature (Backend)
1. Add entity to `Domain/Entities/` and enum to `Domain/Enums/` if needed
2. Add `DbSet<T>` to `IApplicationDbContext` and `AppDbContext`
3. Create `Configurations/` class for EF Fluent API
4. Add migration: `dotnet ef migrations add <Name> -p RunTracker.Infrastructure -s RunTracker.Web`
5. Create query/command + handler in `Application/<Feature>/`
6. Register endpoint in `Web/Endpoints/<Feature>Endpoints.cs` and map in `Program.cs`

### Adding a New Feature (Frontend)
1. Add types to `types/index.ts`
2. Add API call to `api/client.ts`
3. Add TanStack Query hook to `hooks/useQueries.ts`
4. Create feature component in `features/<feature>/`
5. Add route to `App.tsx`

### CQRS Handler Pattern
```csharp
public record MyQuery(int UserId) : IRequest<MyDto>;

public class MyQueryHandler(IApplicationDbContext db) : IRequestHandler<MyQuery, MyDto>
{
    public async Task<MyDto> Handle(MyQuery request, CancellationToken ct)
    {
        // query db, return dto
    }
}
```

### Endpoint Pattern
```csharp
app.MapGet("/api/feature", async (ISender sender, ClaimsPrincipal user) =>
{
    var userId = user.GetUserId();
    var result = await sender.Send(new MyQuery(userId));
    return Results.Ok(result);
}).RequireAuthorization();
```

---

## External Integrations

| Service | Usage |
|---------|-------|
| **Strava API** | OAuth login, activity fetch (distance, time, polyline, streams), webhook push |
| **OpenStreetMap Overpass API** | City boundary and street network import |
| **MapLibre GL / Stamen tiles** | Map rendering in the frontend |

---

## Infrastructure

- **Database**: SQL Server (LocalDB for dev, containerized for prod)
- **Spatial**: NetTopologySuite enables `geometry` columns and spatial queries (`STDistance`, `STIntersects`)
- **Docker**: `docker-compose.yml` runs `app` + `sqlserver` containers
- **Migrations**: Code-first EF migrations in `Infrastructure/Persistence/Migrations/`
- **Theme**: Dark/light mode toggle via `ThemeProvider` (persisted in `localStorage`)
