# Dhara Dairy

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

If the server's reply uses different field names, adjust `mapLoginResponse()` in `src/services/auth/auth.service.ts`.

## After sign-in: centres, menu and report columns (3 extra APIs)

Order of events:

1. `POST /home/userlogin` returns the encrypted login JSON. It is decrypted in `auth.service.ts`.
2. From that decrypted record: the **user id** (`userid`, fallback `id`) and the **station id** (`stationid` / `station`).
3. Three calls, in parallel, once, right after sign-in (`services/bootstrap.ts`, `loadSessionData`):

| API | Angular original | Here | Used for |
| --- | --- | --- | --- |
| `getCenter(id)` | `POST staticIP + /home/farmercollectiondpu`, body `{ id }`, reply as text, strip `\r\n`, `JSON.parse` | `services/center/center.service.ts` (`id` = station id) | the centre list: stored in `GLOBALS.centerdata`; every combo box reads it with `useCenters()` |
| `getMenu(userid)` | `GET staticIP + /dairy/dairy/getmenu?userid=` | `services/menu/menu.service.ts` | the left menu (`layout/nav.ts` `buildNav`) |
| `getReportAccess(userid)` | `GET staticIP + /home/userReportConfig?userid=` | `services/report/report.service.ts` | which columns of the Farmer collection report this user sees (Collections page, also in Excel/CSV/PDF) |

No form calls `getCenter` itself. The centre list is fetched once; Collections, Farmers and the other pages only read it. The VLC ids used by every report are the ids of this list (if `getCenter` fails, the VLC ids from the login record are used instead).

### What the replies look like (seen on a real login)

- Login record: `id` (user id), `CustomStationId` (all station ids in one comma separated string: passed **whole** to `getCenter`), `SessionID` (VLC ids).
- `getMenu`: `[{ ModuleName, DETAILS: [{ FormName, FormClassName, Status, IsActive }] }]`. A module is a sidebar group, a form is a link; `Status`/`IsActive` = 0 hides it; forms that are not pages of this app are left out; the app's other pages stay under **More** (`VITE_MENU_ONLY=1` removes them).
- `getReportAccess`: `[{ Report, fields: [{ column, visible, order }] }]`. `visible:false` hides the column, `order` sets its position (Collections > Farmer collection, Excel/CSV/PDF too). A report without `fields` shows everything.
- Settings > **Session check** shows what each call returned (and the error if one failed).

### Encrypted at rest, decrypted on every page

- localStorage never holds readable session data. It holds two entries, both `ciphertext:iv` (AES-CBC, `lib/vault.ts`): `dhara-login` (the login JSON **without the password**) and `dhara-session-data` (the three replies).
- Every page open runs `useLoginData()` / `restoreSession()` (`App.tsx` `SessionGate`): it decrypts both again and rebuilds the session in memory. If the stored text was edited by hand it cannot be decrypted and the user is signed out.
- The old readable `dhara-user` entry is removed on start.
- Note: the AES key is in the browser bundle, so this stops casual editing, it is not a replacement for the server checking every request.

### If a reply uses other key names

`npm run dev`, sign in, open the console: `[bootstrap]`, `[getCenter]`, `[getMenu]`, `[getReportAccess]` print what was found and the raw replies. Adjust, in one place each:

- centre id / name keys: `ID_KEYS` / `NAME_KEYS` in `center.service.ts`
- menu title / url / parent keys and the menu-to-page table `ROUTES`: `menu.service.ts`
- report column names: `FARMER_COL_NAMES` in `pages/Collections.tsx`; the reply shapes understood are documented in `report.service.ts`
- user id / station id keys of the login record: `mapLoginResponse()` in `auth.service.ts`

A column the report-access reply says nothing about stays visible, and a menu that matches none of this app's pages falls back to the built-in menu, so a reply in an unexpected shape never hides data or empties the sidebar.

## Why it is fast now (and why it no longer shows 0 L while loading)

- `http/client.ts` has a priority queue (6 requests at a time). 0 = what the top card needs, 1 = normal, 2 = background (top-bar alerts, top suppliers, farmer counts). Background requests never block the screen you are looking at, and a waiting request moves forward if something urgent asks for the same data.
- Dashboard "Milk received" asks for today's total straight away (one request) instead of waiting for the line chart. Only if today has no milk yet does it fall back to the latest day.
- `fanOut` no longer sends the first VLC alone; all VLCs are queued at once.
- `useQuery` keeps showing the loader until real rows arrive. An empty answer from the first centre is no longer treated as "0 L".
- `refetchAll()` refreshes only the widgets on screen. A 502/503/504 or dropped connection is retried once.

## SmartX data layer (Dashboard and Collections)

All portal calls live in `src/services/`, one service file per resource:

| Path | Job |
| --- | --- |
| `config.ts` | Gateway path, 90 s timeout, date format. The only place for settings. |
| `session.ts` | VLC ids, VLC names, station and MCC ids from the login response (nothing hardcoded). |
| `auth/auth.service.ts` | `POST /home/userlogin` (encrypted payload) and the login-record mapping. |
| `dashboard/dashboard.service.ts` | `GET /home/dashboardLinechart` and `GET /home/topMilkSupplier`. |
| `vlcc/vlcc.service.ts` | `POST /home/VlccCollection`. Shows the portal's own numbers (no fallback). One request with all VLC ids in `id` and `stationid`, milktype `Z`, and `mccid` (709). |
| `farmer/farmer.service.ts` | `POST /home/farmercollection`, `POST /home/FarmerMilkEntry`, `POST /home/farmermaster`. |
| `farmer/farmerBook.ts` | Registered farmers merged with what they poured. |
| `http/client.ts` | Gateway transport. POST replies are text: `\r\n` stripped, then `JSON.parse`. `{"Success":false,"Message":"No Record !"}` is an empty list. |
| `http/fanout.ts` | One request per VLC and milk type; the FIRST VLC is sent alone, the others follow. |
| `types/raw.ts` | Raw response types with the exact keys the portal sends. |
| `mappers/*.mapper.ts` | The only place that turns strings into numbers and normalises C/B/M, E/M/Z, Cow/Buffalo/Mix (VLC, farmer, dashboard trend, centres). |
| `utils/` | Milk kinds, date helpers, number parsing. |

Hooks live in `src/hooks/`: `useQuery.ts` (per-widget loading / error / retry, one shared request per query, last good result cached in localStorage) and `useSmartxData.ts`.

The Dashboard "Monthly collection" graph has a centre dropdown that lists villages by name (`services/vlcc/villages.ts` seeds the names; login and loaded rows override them): **All** merges `dashboardLinechart` of every VLC, a single centre calls it with that `vlccid` only.

VLC / station / MCC ids are read from the login response (`vlccid`, `stationid`, `mccid`). If your login record uses other key names, run `npm run dev`, sign in and look at the `[login] response keys` line in the browser console, then add the name in `mapLoginResponse()` (`src/services/auth/auth.service.ts`). As a fallback you can set `VITE_VLCC_IDS`, `VITE_STATION_ID` and `VITE_MCC_ID` in `.env.local`. `VlccCollection` returns HTTP 500 without `mccid` (for this dairy: `709`, as the portal itself sends), so it is checked before the call and empty ids are never sent.

If the portal rejects the `fromdate` / `todate` format, set `VITE_API_DATE_FORMAT` (see `.env.example`).

In dev, when the loaded day is 16 Oct 2026, the Dashboard prints a PASS/FAIL table of the reference totals in the console.

## Everything is live: no sample data

Every page reads the SmartX portal. There is no generated or mock data in the project.

| Page | Portal endpoint(s) |
| --- | --- |
| Dashboard | `GET /home/dashboardLinechart`, `GET /home/topMilkSupplier`, `POST /home/VlccCollection`, `POST /home/farmercollection` |
| Collections | tabs: **VLC collection** (`VlccCollection`), **Farmer collection** (`farmercollection`), **Farmerwise collection** (`POST /home/FarmerMilkEntry`, extra field `rateid`) |
| Farmers | `POST /home/farmermaster` (JSON `{ "VillageIds": "id1,id2" }`) merged with `farmercollection`, per VLC (`vlccid + farmerid`) |
| Live collection | `farmercollection` for today, refreshed every minute |
| Centres | the VLC ids of the login, with today's litres / farmers / last sample from `farmercollection` |
| Rate chart | the `rtpl` (rate) of every sample: average per milk type and a fat x SNF matrix of rates actually paid |
| Billing | ten-day totals per farmer from `farmercollection` (amounts are the portal's own) |
| Quality watch | flags real samples against the limits in Settings (low fat, low SNF, water) |
| Data pipeline | latest sample per centre and the list of endpoints in use |
| Settings | theme and alert limits (saved in this browser) |

Removed because the portal API has no data for them: Milk sales, machine calibration / sync controls, the local demo "Create account" and the simulated live feed.

### Global.ts

`src/lib/global.ts` is the React port of the Angular `Global.ts`: `GLOBALS` (plantid, sessionid, customsessionid, mccid, centerdata, id; filled at login by `setSession`), `GLOBALPAGESIZE` (100 rows), `GLOBALSMILK` (C, B, Z = Both, M = Mix), `GLOBALSSHIFT` (M, E, Z) and `Pagination`. `environment.staticIP` (`/gateway/Interceptor?path=`) lives in `src/services/config.ts`.

### Dev login

`npm run dev` pre-fills the login form from `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD` in `.env.local`. Production builds ignore them.

### Farmerwise tab and `rateid`

If the Farmerwise tab shows an error or no rows, enter the rate chart id in the **Rate ID** field (or set `VITE_RATE_ID`). Its columns are shown exactly as the portal sends them.

## Contact form and backend

The contact form does not transmit or store submissions. Account details and preferences use this browser's local storage.
