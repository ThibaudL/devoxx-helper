# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

No lint or test scripts are configured.

## Architecture

**Vue 3 SPA** for sharing Devoxx France conference schedules with friends and teams. Deployed on Vercel with a serverless API proxy and Supabase as the backend.

### Data Flow

1. Session data is fetched from `/api/schedule/{day}` (wednesday/thursday/friday), which proxies `https://devoxxfr2026.cfp.dev/api/public/schedules` with 5-min caching headers.
2. Raw CFP slots are normalized by `toSession()` in `src/stores/sessions.js` — keynotes, proposals, and breaks each follow different transformation paths.
3. Pinia stores (`auth`, `sessions`, `sharing`) hold global state; components read from stores and mutate via store actions.
4. User bookmarks and team data are persisted in Supabase (`agenda_items`, `teams`, `team_members`, `team_invites` tables + RPC functions `create_team`, `join_team_by_token`, `get_invite_info`).

### Key Patterns

**Auth:** `useAuthStore` wraps Supabase Auth (Google OAuth). It exposes a `ready` promise that the router awaits before evaluating guards — this prevents a login flash on initial load.

**Modal system:** Modals are inline `v-if` components controlled by boolean refs. `useModalHistory` composable wires each modal to the browser back button so pressing back closes the top modal.

**Keynote simulcasts:** The same keynote broadcasts to multiple rooms. `toSession()` detects room-placeholder slots and copies real data into them using a `group_key`. These render as a single card spanning rooms.

**Sharing/teams:** Users create teams, invite members via shareable `/invite/{token}` links. `useSharingStore` loads each team member's bookmarks so the UI can show which sessions friends have bookmarked.

**Dark mode:** Initialized in `index.html` before Vue mounts (to avoid flash). Persisted in `localStorage` with system-preference fallback. Managed by `useDarkMode` composable.

### Environment Variables

Stored in `.env.local` (not committed):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (also `VITE_SUPABASE_PUBLISHABLE_KEY`)

### Dev Proxy

`vite.config.js` proxies `/api/schedule` to the CFP API in development, avoiding CORS. `vercel.json` replicates this routing in production and adds an SPA fallback for all other routes.

### Stack Versions

- Vue 3 with `<script setup>` Composition API (no TypeScript)
- Pinia 3, Vue Router 4, Vite 8, Supabase JS v2
