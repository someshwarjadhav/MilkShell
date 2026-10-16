# Dhara – Dairy collection cloud

React + TypeScript + Tailwind CSS + Vite dashboard for a dairy cooperative. Analyzer machine → collector app → server → dashboard. Cow, buffalo and goat (sheli) milk are tracked separately.

## Run locally

```bash
npm install
npm run dev      # Opens the site in a browser; default URL: http://localhost:5173
npm run build    # TypeScript check and production build
npm run preview  # Preview the production build
```

## Login (real API)

Sign-in calls `POST /home/userlogin` on the SmartX server. The body is `{ "payload": "<base64 ciphertext>:<base64 iv>" }` (AES-CBC) and the reply is `{ "data": "<ciphertext>:<iv>" }`.

Setup:

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_ENCRYPTION_KEY` (git-ignored).
3. `npm run dev` - requests to `/api/...` are forwarded to `https://smartx.shivinfotech.co.in` by the proxy in `vite.config.ts`.

Production: the dev proxy does not exist in a built site. Either keep `VITE_API_BASE_URL=https://smartx.shivinfotech.co.in` in `.env.production` (the server must allow CORS for your domain), or set it to `/api` and add a reverse-proxy rule on your web server, e.g. nginx:

```nginx
location /api/ { proxy_pass https://smartx.shivinfotech.co.in/; proxy_ssl_server_name on; }
```

If the server's reply uses different field names, adjust `mapLoginResponse()` in `src/lib/api.ts`.

## Pages

- **Dashboard** — daily summary cards, collection trend, milk mix, centre comparison and top suppliers.
- **Live collection** — generated demo entries, live totals, latest receipt and machine status. Pause/resume the simulated feed.
- **Collections** — filter sample records and switch between every sample, by farmer, by centre, by day and by milk type. Export CSV/Excel or open a print-ready report.
- **Farmers** — search/filter, add a demo farmer, inspect a farmer ledger and pause/reactivate a farmer.
- **Centres & devices** — centre capacity and sync status, plus machine calibration and sync controls.
- **Rate chart** — adjust separate milk-type formulas, test a sample and view the rate matrix.
- **Billing** — select a ten-day cycle, set advance recovery, mark bills paid and open/print payslips.
- **Milk sales** — review milk-type stock, create demo dispatches and toggle payment status.
- **Quality watch** — inspect flagged samples and charts over today, 7 days or 30 days.
- **Data pipeline** — follow the analyzer → collector app → cloud → reports flow and review sync logs.
- **Settings** — choose light/dark theme, save quality limits and reset sample data.
- **Create account** — create a browser-local demo profile; no authentication backend is connected.
- **Contact support** — prepare a support request. The send action intentionally shows a temporary not-sent error until a backend is connected.

## Demo data and backend

Data is generated locally in `src/context/DataContext.tsx` and `src/lib/mockData.ts`. Login uses the real API; create-account is still a prototype-only, browser-local profile. Account details and preferences use this browser's local storage; dashboard records are sample data. The contact form does not transmit or store submissions. Connect an authenticated API and support endpoint before production use.

To connect a real backend, replace the seed functions in `src/context/DataContext.tsx` with API calls and keep the shared types in `src/types.ts`.
