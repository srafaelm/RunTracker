# Feature Plan: Health Connect, HR Zone Export, Route Management

## Context
Three new features for RunTracker, prioritized in order of implementation. The project uses Clean Architecture (Domain/Application/Infrastructure/Web) with CQRS via MediatR, EF Core 10 + SQL Server, and a React/TypeScript frontend.

---

## Feature 1: HR Zone Time in Activity Export (FIRST)

**Goal**: Include time spent in each HR zone when exporting activities.

### Application Layer

**New file: `src/RunTracker.Application/Common/HrZoneTimeCalculator.cs`**
- Static method: `List<ZoneTimeResult> Calculate(ZoneBoundary[] zones, List<ActivityStream> streams)`
- `ZoneTimeResult` record: `(int Zone, string Label, int LowerBpm, int UpperBpm, int TimeSeconds)`
- Logic: sort streams by PointIndex, for each consecutive pair with valid HeartRate + Time, compute delta time and attribute to matching zone
- Returns all zones including those with 0 seconds

**Modify: `src/RunTracker.Application/Activities/Queries/FullExportQuery.cs`**
- Load user's HR zone settings (MaxHeartRate, RestingHeartRate, HrZoneAlgorithm, CustomHrZones)
- Compute zone boundaries via existing `HrZoneCalculator.GetZones()`
- For each activity with streams, call `HrZoneTimeCalculator.Calculate()`
- Add zone columns to CSV: `zone1_label`, `zone1_sec`, `zone2_label`, `zone2_sec`, ...
- Add zone data to JSON export
- In GPX: add summary extension at `<trk>` level with zone totals

**Modify: `src/RunTracker.Application/Activities/Queries/ActivityQueries.cs`** (CSV export)
- Add `hrzones` as new export field option
- When selected, compute and append zone time columns per activity

### Frontend

**Modify: `src/web-client/src/features/activities/ActivityExportDialog.tsx`**
- Add "HR Zone Time" checkbox to export field options

### Key files
- `src/RunTracker.Application/Common/HrZoneCalculator.cs` (reuse for zone boundaries)
- `src/RunTracker.Application/Activities/Queries/FullExportQuery.cs` (modify)
- `src/RunTracker.Application/Activities/Queries/ActivityQueries.cs` (modify)

### Verification
- Export an activity with HR data, verify CSV contains zone time columns
- Export full ZIP, verify JSON and GPX include zone data
- Export activity without HR data, verify graceful handling (empty/zero columns)

---

## Feature 2: Health Connect Integration (SECOND)

**Goal**: REST endpoint to import activities from Health Connect. A companion Android app can be built later to read Health Connect and push data to this endpoint.

### Domain Layer

**Modify: `src/RunTracker.Domain/Enums/ActivitySource.cs`**
- Add `HealthConnect = 4`

### Application Layer

**New: `src/RunTracker.Application/Activities/Commands/ImportHealthConnectActivityCommand.cs`**
- Command record with: Name, ExerciseType (string), StartDate, EndDate, DistanceM, Calories, AvgHR, MaxHR, AvgCadence, StreamPoints (list of lat/lng/alt/time/distance/hr/cadence/speed)
- Returns `ActivityDetailDto`

**New: `src/RunTracker.Application/Activities/Commands/HealthConnectExerciseTypeMapper.cs`**
- Static mapper from Health Connect exercise type strings to `SportType` enum
- Unmapped types -> `SportType.Other`

### Infrastructure Layer

**New: `src/RunTracker.Infrastructure/Handlers/ImportHealthConnectActivityCommandHandler.cs`**
- Follow pattern of `ImportGpxActivityCommandHandler`
- Create Activity with `Source = ActivitySource.HealthConnect`
- Create ActivityStream records with spatial Points
- Encode polylines from GPS data
- Trigger downstream: PRs, VO2max, street matching, tiles, badges

### Web API

**Modify: `src/RunTracker.Web/Endpoints/ActivityEndpoints.cs`**
- `POST /api/activities/import/healthconnect` - accepts JSON body, requires auth

### Frontend
- Add `HealthConnect = 4` to ActivitySource enum in types
- Activities appear automatically in all views

### Future: Android Companion App
- A dedicated Android app that reads Health Connect data and syncs to the backend via this endpoint can be built as a follow-up project.

### Key files
- `src/RunTracker.Infrastructure/Handlers/ImportGpxActivityCommandHandler.cs` (reference pattern)
- `src/RunTracker.Infrastructure/Services/PersonalRecordService.cs` (downstream)
- `src/RunTracker.Infrastructure/Services/Vo2maxSnapshotService.cs` (downstream)

### Verification
- POST a sample Health Connect payload to the endpoint
- Verify Activity + ActivityStreams created correctly
- Verify downstream processing triggers (PRs, badges, tiles)
- Verify activity appears in frontend list and detail views

---

## Feature 3: Route Rating, Sharing, Saving & Management (THIRD)

**Goal**: Transform PlannedRoute from private-only to a social feature with visibility controls, ratings with comments, bookmarks, and community browsing.

### Domain Layer

**New enum: `src/RunTracker.Domain/Enums/RouteVisibility.cs`**
- `Private = 0, Public = 1, Followers = 2, LinkOnly = 3`

**New entity: `src/RunTracker.Domain/Entities/RouteRating.cs`**
- Id (Guid), RouteId, UserId, Rating (1-5), Comment (string?), CreatedAt
- One rating per user per route (upsert behavior)

**New entity: `src/RunTracker.Domain/Entities/RouteSave.cs`**
- Id (Guid), RouteId, UserId, SavedAt

**Modify: `src/RunTracker.Domain/Entities/PlannedRoute.cs`**
- Add: Visibility (RouteVisibility), Category (string?), ElevationGainM (double?), ShareToken (string?)
- Add navigation: ICollection<RouteRating> Ratings, ICollection<RouteSave> Saves

### Application Layer

**Modify/extend: `src/RunTracker.Application/Routes/PlannedRouteHandlers.cs`**

New queries:
- `GetPublicRoutesQuery` - paginated, with search/category filter/sort (rating, distance, newest)
- `GetRouteByShareTokenQuery` - for share links (no auth)
- `GetSavedRoutesQuery` - user's bookmarked routes
- `GetRouteRatingsQuery` - paginated ratings for a route
- `GetRouteDetailQuery` - visibility-aware detail

New commands:
- `UpdatePlannedRouteCommand` - update name, description, visibility, category, etc.
- `DuplicateRouteCommand` - copy a route to own collection
- `RateRouteCommand` - upsert rating + optional comment
- `DeleteRouteRatingCommand` - remove own rating
- `SaveRouteCommand` / `UnsaveRouteCommand` - bookmark toggle
- `GenerateShareTokenCommand` - create unique share token

### Infrastructure Layer

**New EF configs:**
- `RouteRatingConfiguration.cs` - unique index on (RouteId, UserId), Rating 1-5, Comment max 1000
- `RouteSaveConfiguration.cs` - unique index on (RouteId, UserId)

**Modify PlannedRouteConfiguration:**
- Visibility (default Private), Category (max 50), ShareToken (unique index, filtered)
- Navigation properties to Ratings and Saves

**Add DbSets** to IApplicationDbContext: RouteRatings, RouteSaves

**EF Migration**: new tables + new columns on PlannedRoutes

### Web API Endpoints

Extend `src/RunTracker.Web/Endpoints/PlannedRouteEndpoints.cs`:
```
PUT    /api/routes/{id}              -- update route
GET    /api/routes/public            -- browse public routes
GET    /api/routes/shared/{token}    -- share link (AllowAnonymous)
GET    /api/routes/saved             -- bookmarked routes
GET    /api/routes/{id}/ratings      -- list ratings
POST   /api/routes/{id}/ratings      -- add/update rating
DELETE /api/routes/{id}/ratings      -- remove rating
POST   /api/routes/{id}/save         -- bookmark
DELETE /api/routes/{id}/save         -- unbookmark
POST   /api/routes/{id}/duplicate    -- copy to own
POST   /api/routes/{id}/share        -- generate share token
```

### Frontend

**Types** (`src/web-client/src/types/index.ts`):
- RouteVisibility enum, PlannedRouteDetail (extended), RouteRating interface

**API client** (`src/web-client/src/api/client.ts`):
- Add all new route endpoints to plannedRoutesApi

**Hooks** (`src/web-client/src/hooks/useQueries.ts`):
- usePublicRoutes, useSavedRoutes, useRouteRatings, useRouteDetail + mutations

**New pages:**
- `BrowseRoutesPage.tsx` - search/filter/sort public routes, route cards with rating stars
- `RouteDetailPage.tsx` - map, stats, ratings/comments list, save/share/duplicate buttons

**Modified pages:**
- `RouteCreatorPage.tsx` - add visibility selector, category, elevation gain fields

**New components:**
- Star rating input component
- Share dialog (copy-to-clipboard URL)

**Router**: Add `/routes/:id`, `/routes/browse`, `/routes/shared/:token`

### Key files
- `src/RunTracker.Application/Routes/PlannedRouteHandlers.cs` (extend)
- `src/RunTracker.Domain/Entities/PlannedRoute.cs` (modify)
- `src/RunTracker.Web/Endpoints/PlannedRouteEndpoints.cs` (extend)

### Verification
- Create a public route, verify it appears in browse page
- Rate a route, verify average rating updates
- Share a route via link, verify anonymous access works
- Save/unsave a route, verify it appears in saved list
- Duplicate a route, verify copy in own collection
