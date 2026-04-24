# Devoxx Helper

A companion web app for [Devoxx France](https://www.devoxx.fr/) attendees. Browse the full conference schedule, bookmark talks, detect scheduling conflicts, share your agenda with teammates, and take notes — all in one place.

![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs) ![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite) ![Supabase](https://img.shields.io/badge/Supabase-v2-3ecf8e?logo=supabase) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- **Schedule browser** — full agenda for Wednesday, Thursday, and Friday, with room timeline and list views
- **Bookmarks** — save sessions to your personal agenda (requires Google sign-in)
- **Conflict detection** — your planning view flags overlapping sessions automatically
- **Team sharing** — create a team, invite colleagues via a shareable link, and see which talks your friends bookmarked
- **Notes** — add a private note to any individual session, or write a single free-form planning note for your whole schedule
- **Dark mode** — follows system preference, persisted across sessions
- **Mobile-friendly** — responsive layout with pinch-to-zoom in the timeline view

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | Vue 3 (`<script setup>`) |
| State management | Pinia 3 |
| Routing | Vue Router 4 |
| Build tool | Vite 8 |
| Backend / Auth / DB | Supabase (PostgreSQL + Google OAuth) |
| Deployment | Vercel (SPA + serverless API proxy) |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with Google OAuth configured
- (Optional) A [Vercel](https://vercel.com) account for deployment

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/devoxx-helper.git
cd devoxx-helper

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies `/api/schedule/*` to the CFP API, so no CORS issues locally.

### Environment Variables

Create a `.env.local` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Schema

Run the following SQL in your Supabase project to set up the required tables:

```sql
-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  planning_note text
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

-- Bookmarks and per-session notes
create table agenda_items (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  session_id text not null,
  note text,
  unique (user_id, session_id)
);
alter table agenda_items enable row level security;
create policy "Users manage own agenda" on agenda_items
  for all using (auth.uid() = user_id);

-- Teams
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table teams enable row level security;

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key (team_id, user_id)
);
alter table team_members enable row level security;

create table team_invites (
  token text primary key,
  team_id uuid references teams(id) on delete cascade,
  created_at timestamptz default now()
);
alter table team_invites enable row level security;
```

RPC functions (`create_team`, `join_team_by_token`, `get_invite_info`) are used for team operations — see `src/stores/sharing.js` for the call signatures.

## Project Structure

```
├── api/
│   └── schedule/[day].js     # Vercel serverless proxy to CFP API
├── public/
│   └── *.png                 # Venue floor plans
├── src/
│   ├── composables/          # useDarkMode, useModalHistory, usePlanModal
│   ├── stores/               # Pinia stores: auth, sessions, sharing
│   ├── utils/                # Avatar, room colors, session tag helpers
│   ├── views/
│   │   ├── AgendaView.vue    # Main schedule browser (list + timeline)
│   │   ├── SyntheseView.vue  # Personal planning / bookmarks summary
│   │   ├── LoginView.vue
│   │   ├── InviteView.vue    # Team invite landing page
│   │   └── ImportView.vue
│   └── style.css             # Global CSS custom properties + utility classes
├── vercel.json               # SPA fallback + API proxy rules
└── vite.config.js
```

## Available Scripts

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build (output: dist/)
npm run preview  # Serve the production build locally
```

## Deployment

The project is designed to deploy on Vercel with zero configuration. Push to your main branch and Vercel will:

1. Build the Vue SPA (`npm run build`)
2. Serve `dist/` as static assets
3. Route `/api/schedule/*` to the serverless function in `api/`
4. Fall back to `index.html` for all other routes (SPA navigation)

## Architecture Notes

**Session data** is fetched from the Devoxx CFP API (`devoxxfr2026.cfp.dev`) via the serverless proxy, with a 5-minute `Cache-Control` header to avoid hammering the upstream. The proxy normalises raw CFP slots into a consistent `Session` shape.

**Keynote simulcasts** — the same keynote is broadcast to multiple rooms simultaneously. The store's `linkKeynoteSimulcasts()` function detects these by matching `day + start_time`, copies real data onto placeholder slots, and assigns a shared `group_key`. The UI deduplicates on `group_key` before rendering and conflict detection.

**Auth flow** — Google OAuth through Supabase. The `useAuthStore` exposes a `ready` promise that the router awaits before evaluating guards, preventing a login flash on page load.

**Modal system** — modals are inline `v-if` components controlled by boolean refs. The `useModalHistory` composable pushes a history entry when a modal opens and closes it on `popstate`, so the browser back button works as expected.

## Contributing

Contributions are welcome! Feel free to open an issue or a pull request.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request

## License

MIT — see [LICENSE](LICENSE) for details.
