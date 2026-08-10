# Deployment Guide: MongoDB Atlas + Render

This walks through taking the RSA Construction Management System from source code to a live URL,
using MongoDB Atlas (free tier) for the database and Render (free/paid tier) for hosting both the
backend API and the frontend. Total time: roughly 30–45 minutes the first time.

---

## Part 1 — Put the code on GitHub

Render deploys from a Git repository, so the code needs to live on GitHub first.

1. Unzip `RSA-Construction-Management-System.zip` somewhere on your computer.
2. Create a free account at [github.com](https://github.com) if you don't have one.
3. Create a new **empty** repository (no README/license) — e.g. `rsa-construction-system`. Keep
   it Private if you don't want the code public.
4. From a terminal, inside the unzipped folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/rsa-construction-system.git
   git push -u origin main
   ```
   If you're not comfortable with the terminal, GitHub Desktop (desktop.github.com) does the same
   thing with buttons — "Add local repository" → "Publish repository".

---

## Part 2 — MongoDB Atlas (the database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) and sign up / log in.
2. Create a **Project** (e.g. "RSA Construction").
3. Click **Create a Cluster** → choose the **M0 Free** tier → pick a region close to you (e.g.
   Mumbai for India) → keep the default name `Cluster0` or rename it → **Create**. This takes a
   few minutes to provision.
4. **Database Access** (left sidebar) → **Add New Database User**:
   - Username: e.g. `rsa_admin`
   - Password: click "Autogenerate Secure Password" and **copy it somewhere safe**
   - Role: "Read and write to any database"
5. **Network Access** (left sidebar) → **Add IP Address**:
   - For getting started, choose **Allow Access from Anywhere** (`0.0.0.0/0`). Render's servers
     use dynamic IPs, so this is the simplest option (Atlas still requires the username/password
     to connect — it's not an open door).
6. Back on the cluster page, click **Connect** → **Drivers** (or "Connect your application") →
   select **Node.js**. Copy the connection string, which looks like:
   ```
   mongodb+srv://rsa_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with the real password from step 4, and add your database name before the
   `?`, e.g.:
   ```
   mongodb+srv://rsa_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/rsa_construction?retryWrites=true&w=majority
   ```
   **Save this full string** — it's your `MONGODB_URI`.

---

## Part 3 — Deploy the backend (API) on Render

1. Go to [render.com](https://render.com), sign up (you can sign up with your GitHub account,
   which makes the next step easier).
2. **New** → **Web Service** → connect your GitHub account → select the
   `rsa-construction-system` repo.
3. Configure:
   - **Name**: `rsa-backend` (or anything — this becomes part of your URL)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (fine to start; see the note on free-tier sleep below)
4. Under **Environment Variables**, add each of these (values from `backend/.env.example`, with
   your real values):
   | Key | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string from Part 2 |
   | `JWT_SECRET` | any long random string (e.g. generate one at random.org or run `openssl rand -hex 32`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `NODE_ENV` | `production` |
   | `CLIENT_ORIGIN` | leave blank for now — you'll fill this in after Part 4 |
   | `LOW_STOCK_THRESHOLD_PERCENT` | `15` |
   *(`PORT` doesn't need to be set — Render provides it automatically and `server.js` already reads `process.env.PORT`.)*
5. Click **Create Web Service**. Render will build and deploy; watch the logs. When it's live,
   you'll get a URL like `https://rsa-backend.onrender.com`.
6. Check it worked by opening `https://rsa-backend.onrender.com/api/health` in a browser — you
   should see `{"success":true,"status":"ok",...}`.
7. **Load demo/starter data** (optional but recommended once): in the Render dashboard, open your
   service → **Shell** tab → run:
   ```bash
   npm run seed
   ```
   This creates the admin login (`admin@rsaconstruction.com` / `Admin@123`) and sample stock so
   you can log in immediately. **Change that password after your first login** (or ask for a
   "change password" feature to be added — the current build doesn't have a self-service password
   change screen yet).

---

## Part 4 — Deploy the frontend on Render

1. **New** → **Static Site** → same GitHub repo.
2. Configure:
   - **Name**: `rsa-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://rsa-backend.onrender.com/api` (your backend URL from Part 3, with `/api` on the end) |
4. Click **Create Static Site**. When it finishes, you'll get a URL like
   `https://rsa-frontend.onrender.com` — this is the link you give to staff.
5. Since this is a single-page app with client-side routes (`/billing`, `/materials`, etc.), add a
   rewrite rule so refreshing a page doesn't 404: in the Static Site settings → **Redirects/Rewrites**
   → add `/*` → `/index.html` → type **Rewrite**.

---

## Part 5 — Connect the two (CORS)

Go back to the **backend** service on Render → **Environment** → set:

| Key | Value |
|---|---|
| `CLIENT_ORIGIN` | `https://rsa-frontend.onrender.com` (your actual frontend URL, no trailing slash) |

Save — Render will redeploy the backend automatically. This is what allows the frontend's browser
requests to reach the API (otherwise they'll be blocked by CORS).

---

## Part 6 — Test it

1. Open your frontend URL.
2. Log in with `admin@rsaconstruction.com` / `Admin@123` (or whatever you seeded).
3. Create a test Delivery Note, confirm the total calculates correctly, print it (Ctrl+P → Save as
   PDF) and compare against the paper pad.
4. Create a Material Entry, confirm it shows up in the ledger and the Dashboard's stock numbers.
5. Delete the test delivery note afterward so it doesn't skew real reports.

---

## Important operational notes

- **Free tier sleep**: Render's free Web Services spin down after ~15 minutes of no traffic, and
  the next request takes 30–60 seconds to "wake up." Fine for testing; annoying for staff using
  this during work hours. For real use, upgrade the **backend** service to a paid instance (Static
  Sites for the frontend are free either way and don't sleep).
- **Backups**: Atlas M0 doesn't include automated backups. Once this is real business data, either
  upgrade to a paid Atlas tier (M10+) which includes continuous backups, or set up a scheduled
  `mongodump` export somewhere safe.
- **Custom domain**: both Render services support adding your own domain (e.g.
  `billing.rsaconstruction.com`) for free under Settings → Custom Domains — just point a CNAME at
  the Render URL.
- **Every future code change**: push to the `main` branch on GitHub; Render auto-deploys both
  services on every push by default.

---

Sources consulted for current Render/Atlas UI steps:
- [Deploy a Node Express App — Render Docs](https://render.com/docs/deploy-node-express-app)
- [Web Services — Render Docs](https://render.com/docs/web-services)
- [Deploy a Free Cluster — MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
- [Deploying a Static Site — Vite Docs](https://vite.dev/guide/static-deploy)
