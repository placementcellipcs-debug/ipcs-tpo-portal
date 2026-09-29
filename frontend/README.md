# IPCS TPO Portal — Frontend

The frontend is organized by responsibility so routes, feature pages, shared UI, and assets are easy to find.

## Source map

- `src/app/` — application routes and lazy-loaded pages.
- `src/features/placements/` — dashboard, students, hiring partners, vacancies, drives, and placement reports.
- `src/features/learning/` — academics, courses, exams, and study materials.
- `src/features/assets/` — asset register, inventory, transfers, and maintenance.
- `src/features/media/` — media and design workspace.
- `src/features/admin/` — account settings, users, security, and administration.
- `src/features/public/` — public pages, about content, and sign-in experience.
- `src/components/` — shared interface components.
- `src/layouts/` — authenticated application shells.
- `src/services/` — API configuration and appearance preferences.
- `src/styles/` — global styles and design tokens.
- `src/assets/brand/` — IPCS brand images.
- `src/assets/media/` — video and other media files.
- `src/assets/Team IPCS/` — team profile photos used on the About page.

The backend is under `../backend`; its Express routes are in `server.js` and Google Sheets/data handlers are in `src/`.

## Local commands

Run these from this directory:

- `npm run dev` — start the Vite development server.
- `npm run lint` — lint application source and Vite/ESLint configuration.
- `npm run build` — create the production frontend bundle.
