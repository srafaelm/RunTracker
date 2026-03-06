# AGENTS.md — RunTracker

Guidelines for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on this codebase.

---

## Project Overview

RunTracker is a self-hosted running statistics app. Backend: .NET 9 Clean Architecture (MediatR CQRS + EF Core + SQL Server). Frontend: React 18 + TypeScript SPA. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown.

**Solution file**: `RunTracker.slnx`
**Entry point**: `src/RunTracker.Web/Program.cs`
**Frontend root**: `src/web-client/`

---

## Key Architectural Rules

- **Dependency direction**: `Domain ← Application ← Infrastructure ← Web`. Never violate this.
- **No EF Core in Application**: Application layer only touches `IApplicationDbContext` — never `AppDbContext` directly.
- **No business logic in Web**: Endpoints call `ISender.Send()` and return the result. That's it.
- **No AutoMapper**: Use **Mapster** for DTO mapping. Call `.Adapt<TDto>()` on entities or use `ProjectToType<TDto>()` in LINQ projections.
- **MediatR for all use cases**: Every new API operation must be a `IRequest<T>` handled by a `IRequestHandler<,>`.

---

## Backend Conventions

### Queries & Commands
- Queries live in `Application/<Feature>/Queries/`
- Commands live in `Application/<Feature>/Commands/`
- Use `record` types for requests (immutable, value equality)
- Handler and request can be in the same file for small features

```csharp
// Pattern to follow
public record GetFooQuery(string UserId, int Id) : IRequest<FooDto>;

internal sealed class GetFooQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetFooQuery, FooDto>
{
    public async Task<FooDto> Handle(GetFooQuery request, CancellationToken ct)
    {
        var entity = await db.Foos
            .Where(f => f.UserId == request.UserId && f.Id == request.Id)
            .ProjectToType<FooDto>()
            .FirstOrDefaultAsync(ct);

        return entity ?? throw new NotFoundException(nameof(Foo), request.Id);
    }
}
```

### Endpoints
- Group by feature in `Web/Endpoints/<Feature>Endpoints.cs`
- Register the group in `Program.cs` with a single `MapFeatureEndpoints()` extension call
- Always extract `UserId` from `ClaimsPrincipal` — never trust user-provided IDs
- Always call `.RequireAuthorization()` unless the endpoint is public (auth/register, auth/login)

```csharp
// Pattern to follow
public static class FooEndpoints
{
    public static void MapFooEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/foos").RequireAuthorization();

        group.MapGet("/", async (ISender sender, ClaimsPrincipal user) =>
        {
            var result = await sender.Send(new GetFooListQuery(user.GetUserId()));
            return Results.Ok(result);
        });
    }
}
```

### Entities & Migrations
- Define entity config in `Infrastructure/Persistence/Configurations/<Entity>Configuration.cs`
- Use `IEntityTypeConfiguration<T>` with Fluent API — no data annotations in entities
- After changing the domain model, run:
  ```bash
  dotnet ef migrations add <DescriptiveName> \
    -p src/RunTracker.Infrastructure \
    -s src/RunTracker.Web
  ```
- Geospatial columns: always set `HasSrid(4326)` and use `NetTopologySuite` types

### Validation
- Add a `FluentValidation.AbstractValidator<TCommand>` alongside each command
- Validators are auto-registered from the Application assembly — no manual DI wiring needed

---

## Frontend Conventions

### File Layout
```
features/<feature>/
├── <Feature>Page.tsx     (top-level page, registered in App.tsx)
└── components/           (feature-local components)
```

### Data Fetching
- All server state goes through **TanStack Query** hooks in `hooks/useQueries.ts`
- API calls live in `api/client.ts` — typed functions returning typed responses
- Never call `axios` directly from components

```typescript
// api/client.ts
export async function getFoos(): Promise<Foo[]> {
  const { data } = await apiClient.get<Foo[]>('/foos');
  return data;
}

// hooks/useQueries.ts
export function useFoos() {
  return useQuery({ queryKey: ['foos'], queryFn: getFoos });
}
```

### Types
- All shared types live in `src/web-client/src/types/index.ts`
- Mirror the backend DTO shape exactly — use `camelCase` (axios handles the casing)
- Use `number` for IDs (not `string`)

### Styling
- Use **Tailwind CSS** utility classes
- Do not add custom CSS files; use `@apply` in `index.css` only for truly global resets
- Dark theme uses `dark:` variants — the app uses `dark` class on `<html>`

### Build
- Production build: `npm run build` in `src/web-client/` → outputs to `src/RunTracker.Web/wwwroot/`
- Dev server: `npm run dev` (port 5173), proxied by .NET in dev mode

---

## Common Tasks

### Run the app locally
```bash
# Start SQL Server container
docker compose up sqlserver -d

# Backend (port 5122)
cd src/RunTracker.Web && dotnet run

# Frontend dev server (port 5173)
cd src/web-client && npm run dev
```

### Run all tests
```bash
dotnet test RunTracker.slnx
```

### Add a new API endpoint end-to-end
1. Add/update entity in `Domain/Entities/` if needed
2. Update `IApplicationDbContext` with new `DbSet<T>`
3. Update `AppDbContext` and add `EntityTypeConfiguration`
4. Run EF migration
5. Create Query or Command + Handler in `Application/`
6. Add endpoint in `Web/Endpoints/`
7. Register in `Program.cs`
8. Add TypeScript type in `types/index.ts`
9. Add API function in `api/client.ts`
10. Add hook in `hooks/useQueries.ts`
11. Wire up in the relevant React feature page

### Add a new frontend page
1. Create `features/<feature>/<Feature>Page.tsx`
2. Add route in `App.tsx`
3. Add nav link in `components/Navbar.tsx` if needed

---

## What NOT to Do

- Do not add business logic to `Web` endpoints — keep them as thin dispatchers
- Do not bypass the `IApplicationDbContext` abstraction by injecting `AppDbContext` into Application
- Do not use AutoMapper — Mapster only
- Do not use `useEffect` + `fetch` for server data — always use TanStack Query hooks
- Do not add EF navigation property loading in Application handlers with `.Include()` chains unnecessarily — prefer explicit `ProjectToType<T>()` projections
- Do not commit secrets to `appsettings.json` — use environment variables or user secrets
- Do not create new utility files for one-off operations — inline simple helpers

---

## Environment Variables (Production)

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__DefaultConnection` | SQL Server connection string |
| `Jwt__Secret` | JWT signing key (min 32 chars) |
| `Jwt__Issuer` | JWT issuer (default: `RunTracker`) |
| `Jwt__Audience` | JWT audience (default: `RunTracker`) |
| `Strava__ClientId` | Strava API client ID |
| `Strava__ClientSecret` | Strava API client secret |
| `Strava__RedirectUri` | OAuth callback URL |
| `Frontend__Url` | Public URL of the frontend |

---

## Project Status

See [ARCHITECTURE.md#implemented-features](ARCHITECTURE.md#implemented-features) for a complete list of implemented features.

Current work-in-progress (untracked files in git):
- `Training` feature: full CQRS stack + endpoints + React frontend (`features/training/`)
- `ScheduledWorkout` entity with EF migration (`20260225090143_AddTrainingSchedule`)
