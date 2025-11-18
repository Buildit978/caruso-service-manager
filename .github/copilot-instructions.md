# Copilot Instructions for caruso-service-manager

## Project Overview
- **Monorepo structure:**
  - `backend/`: Node.js (Express, TypeScript, Mongoose) REST API for service management
  - `frontend/`: React + TypeScript + Vite SPA for user interaction
- **Data flow:**
  - Frontend communicates with backend via REST API (`/api/*` endpoints)
  - Backend connects to MongoDB using Mongoose; connection string via `.env` (`MONGO_URI`)

## Key Workflows
- **Backend:**
  - Start dev server: `npm run dev` (uses `ts-node-dev`)
  - Main entry: `src/server.ts` (sets up Express, routes, DB)
  - API routes: `/api/customers`, `/api/work-orders`, `/api/summary`, `/api/settings`, `/api/invoices`
  - Add new routes in `src/routes/`, models in `src/models/`
  - DB config: `src/config/db.ts` (reads `MONGO_URI` from env)
- **Frontend:**
  - Start dev server: `npm run dev` (uses Vite)
  - Build: `npm run build`
  - Lint: `npm run lint`
  - Main entry: `src/main.tsx`, root component: `src/App.tsx`
  - API calls: `src/api/client.ts` (uses Axios, base URL from `VITE_API_BASE_URL` or defaults to `http://localhost:4000/api`)
  - Page components in `src/pages/`, shared UI in `src/components/`

## Patterns & Conventions
- **API:** Always use `/api/` prefix for backend routes to match frontend expectations
- **Frontend API calls:** Use `api` from `src/api/client.ts` for HTTP requests; prefer async/await
- **Type usage:** Shared types for API responses in `src/types/`
- **Error handling:** Frontend pages show error messages in red; backend logs errors and exits on DB failure
- **State management:** React hooks (`useState`, `useEffect`) for local state; no global state library
- **Styling:** CSS modules and global styles in `src/App.css`, `src/index.css`, and component-specific CSS

## Integration Points
- **MongoDB:** Connection via Mongoose, URI from `.env` (`MONGO_URI`)
- **Environment variables:**
  - Backend: `.env` for DB connection
  - Frontend: `.env` or Vite env for API base URL (`VITE_API_BASE_URL`)
- **CORS:** Enabled for frontend-backend communication

## Examples
- **Add a new API route:**
  - Backend: Create route in `src/routes/`, add to `src/server.ts`
  - Frontend: Add API function in `src/api/`, call from page/component
- **Add a new model:**
  - Backend: Create schema in `src/models/`, use in route/controller

## References
- Backend entry: `backend/src/server.ts`
- Frontend entry: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- API client: `frontend/src/api/client.ts`
- Types: `frontend/src/types/`
- Backend models: `backend/src/models/`
- Backend routes: `backend/src/routes/`

---
_If any section is unclear or missing, please provide feedback for improvement._
