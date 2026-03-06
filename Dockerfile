# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY src/web-client/package*.json ./
RUN npm ci
COPY src/web-client/ ./
RUN npm run build

# Stage 2: Build .NET backend
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend-build
WORKDIR /src
COPY src/RunTracker.Domain/RunTracker.Domain.csproj src/RunTracker.Domain/
COPY src/RunTracker.Application/RunTracker.Application.csproj src/RunTracker.Application/
COPY src/RunTracker.Infrastructure/RunTracker.Infrastructure.csproj src/RunTracker.Infrastructure/
COPY src/RunTracker.Web/RunTracker.Web.csproj src/RunTracker.Web/
RUN dotnet restore src/RunTracker.Web/RunTracker.Web.csproj
COPY src/ src/
RUN dotnet publish src/RunTracker.Web/RunTracker.Web.csproj -c Release -o /app/publish --no-restore

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/RunTracker.Web/wwwroot wwwroot/
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5000
ENTRYPOINT ["dotnet", "RunTracker.Web.dll"]
