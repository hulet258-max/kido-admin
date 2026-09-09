# KIDO Admin

Local content-control frontend for the existing KIDO backend. It uploads videos with metadata/tags and creates reviewed quiz, ordering, and matching activities.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, then set the backend URL and `ADMIN_API_KEY` in the connection panel. This project contains no storage or processing logic; all uploads and content mutations go through `kido-backend`.

Copy `.env.example` to `.env` when the backend runs on a different port, or change the URL directly in the connection panel.
