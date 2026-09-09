# KIDO Admin

Local content-control frontend for the existing KIDO backend. It uploads videos with metadata/tags and creates reviewed quiz, ordering, and matching activities.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, then set the backend URL and `ADMIN_API_KEY` in the connection panel. This project contains no storage or processing logic; all uploads and content mutations go through `kido-backend`.

Copy `.env.example` to `.env` when the backend runs on a different port, or change the URL directly in the connection panel.

## Docker deployment

1. Copy `.env.example` to `.env` if it does not exist.
2. Set `VITE_API_URL` in `.env` to the public backend URL, including `/api`, such as `https://api.example.com/api`. The browser must be able to reach it; Docker service names are not public URLs. The localhost default is only for local use.
3. Run from this directory:

```bash
docker compose up -d --build
```

The admin page is served at `http://localhost:8080`. Change `ADMIN_PORT` in `.env` to use another host port. For public deployment, route your admin HTTPS domain to container port **80** through your hosting platform or reverse proxy. Configure the backend's `CORS_ORIGIN` to allow the admin's full origin, for example `https://admin.example.com`.

For Dockerfile-based hosting such as Easypanel, set the build context to `kido-admin` (or the repository root if deploying the admin repository separately), use `Dockerfile`, configure the **build argument** `VITE_API_URL`, and route traffic to port **80**. The equivalent manual commands are:

```bash
docker build --build-arg VITE_API_URL=https://api.example.com/api -t kido-admin .
docker run -d --name kido-admin --restart unless-stopped -p 8080:80 kido-admin
```

Vite embeds `VITE_API_URL` at build time, so rebuild after changing it. Setting only a runtime environment variable or using `docker run --env-file .env` does not change the built app. Compose passes the value from `.env` to the Docker build automatically. See [Vite environment variables](https://vite.dev/guide/env-and-mode).

Enter the backend's `ADMIN_API_KEY` in the connection panel. Do not place secrets in `VITE_` variables because those values are visible in the browser bundle. Previously saved connection settings override the build default; update the Backend URL in the panel if that browser has connected before.

The container health check uses `/healthz` to verify Nginx is serving; it does not check backend availability. The backend and its storage/database services are deployed separately.
