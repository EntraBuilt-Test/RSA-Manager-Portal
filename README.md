# RSA Construction Management System

A tab-based billing and inventory system that replaces R.S.A Construction's two handwritten
books: the **Delivery Note pad** and the **Material Purchase Ledger**. Built as a full
production stack: **React (Vite)** frontend, **Node.js/Express** backend, **MongoDB** database.

---

## 1. Architecture

```
rsa-construction-system/
├── backend/                 Express REST API
│   ├── models/               Mongoose schemas (User, Customer, DeliveryNote, Material, StockTransaction)
│   ├── controllers/          Business logic per module
│   ├── routes/                REST endpoints, one file per resource
│   ├── middleware/           auth (JWT), validation, central error handler
│   ├── utils/                 calc.js - pure, dependency-free math (qty*rate, stock balances)
│   └── seed/                  demo data loader
├── frontend/                 React app (Vite)
│   └── src/
│       ├── components/       Dashboard, DeliveryNote, MaterialLedger, Reports, Layout, common
│       ├── data/              standardParticulars.js - the pad's fixed 19-row item list
│       ├── api/                axios client + typed API calls
│       └── styles/            app.css (admin UI) + print.css (paper-exact print layouts)
└── docs/
```

Tabs are plain routes under one `Layout` (`frontend/src/components/Layout/Layout.jsx`). Adding a
new module later means: one new folder under `components/`, one new route in `App.jsx`, one new
`<NavLink>` in `Layout.jsx`, and (if needed) one new backend route/controller/model. Nothing else
in the app needs to change - this is the "flexible for future modules" requirement.

## 2. What changed from the paper process

| Paper process | Digital equivalent |
|---|---|
| Hand-numbered Delivery Note pad (S.No column) | Auto-generated `noteNumber` (`DN-2026-0001`), sequential per year |
| Manually multiplying Qty × Rate per line | Computed server-side in `utils/calc.js`, shown live while typing |
| Adding up the Particulars column by hand | Grand Total computed automatically, always consistent with line items |
| Separate mental tally of "how much steel is left" | `Material.remainingStock` kept in sync automatically on every purchase or delivery |
| Re-writing the ledger's running balance by hand | `StockTransaction.balanceAfter` snapshot on every movement - the ledger view *is* the running balance |
| Nothing enforced Cement 100 → used 20 → 80 remaining | `DeliveryNote` creation now atomically deducts matching materials (MongoDB transaction, so billing and stock can't drift apart) |

## 3. Database design (MongoDB / Mongoose)

Five collections, matching the spec plus the fields needed to make the paper-exact print view
and the stock linkage actually work:

- **users** - `name, email, password (bcrypt-hashed), role (admin/manager/staff)`
- **customers** - `name, phone, address`
- **deliveryNotes** - `noteNumber, date, customer (ref), customerNameSnapshot/phone/address (so old notes still print correctly if a customer record changes later), vehicleNumber, items[{itemName, quantity, rate, amount, materialId}], totalAmount, paymentStatus, stockDeducted, createdBy`
- **materials** - `materialName, category, unit, openingStock, quantityPurchased, quantityUsed, remainingStock, purchaseRate, totalAmount, supplier, remarks, reorderLevel`
- **stockTransactions** - `materialId, type (IN/OUT), quantity, rate, balanceAfter, reference, referenceType, date, remarks`

`stockTransactions` is what powers both the Material Ledger table (S.No, Date, Material, Qty,
Rate, Amount, Stock Balance, Remarks) and the Dashboard's low-stock alerts.

## 4. Module-by-module

**Tab 1 - Billing / Delivery Note** (`components/DeliveryNote/`)
- `DeliveryNoteForm.jsx` - pre-fills the exact 19-row Particulars list from the pad
  (`data/standardParticulars.js`, transcribed from the photo), staff fill in only the rows that
  apply, plus "+ Add Custom Item" for anything not on the printed list. Amount = Qty × Rate live.
- `DeliveryNotePrint.jsx` + `styles/print.css` - reproduces the physical pad: red
  "R.S.A CONSTRUCTION" header, cell numbers, address, DELIVERY NOTE title, Date/S.No, customer
  block, the full ruled particulars table, TOTAL, declaration line, Vehicle No, two signature
  blocks, G Pay No, footer banner. Ctrl+P / "Print / Download PDF" produces an A4 page.
- `DeliveryNoteList.jsx` - Save / Edit / Delete / Print / Payment status toggle.

**Tab 2 - Material Stock / Purchase Ledger** (`components/MaterialLedger/`)
- `MaterialEntryForm.jsx` - Date, Material Name, Category, Quantity, Unit, Purchase Rate,
  Supplier, Remarks, live Total Amount = Quantity × Rate.
- `MaterialLedger.jsx` - the ledger-style table (S.No, Date, Material, Qty, Rate, Amount, Stock
  Balance, Remarks), printable via the same print stylesheet.
- `StockView.jsx` - Opening / Purchased / Used / Remaining per material, with low-stock flags.

**Connection between modules** - `backend/controllers/deliveryNoteController.js` matches each
billed item to the Material master (by explicit link or by name) and deducts stock inside the
same database transaction that saves the note. Editing or deleting a note reverses the stock
impact first, so numbers never drift.

**Dashboard** (`components/Dashboard/`) - Today's/Monthly/Yearly Billing, Total Revenue, Pending
Payments, Total Materials, Low Stock Alerts, Recent Transactions - all from
`GET /api/reports/dashboard`.

**Reports** (`components/Reports/`) - Daily Billing & Material Movement, Monthly Revenue &
Material Cost, Yearly Business Summary, with Excel export (client-side, via SheetJS) and a
server-side Excel/PDF export endpoint for the Billing report.

## 5. Setup

**Requirements:** Node.js 18+, a MongoDB connection (Atlas free tier works).

```bash
# Backend
cd backend
cp .env.example .env        # then fill in MONGODB_URI and JWT_SECRET
npm install
npm run seed                 # loads a demo admin user + sample stock/notes
npm run dev                  # http://localhost:5000

# Frontend (separate terminal)
cd frontend
cp .env.example .env         # VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev                  # http://localhost:5173
```

Seeded login: `admin@rsaconstruction.com` / `Admin@123`

**MongoDB Atlas (recommended for production):** create a free M0 cluster at
mongodb.com/atlas, add a database user, allow your server's IP (or 0.0.0.0/0 while testing),
copy the connection string into `backend/.env` as `MONGODB_URI`. Atlas clusters are already
replica sets, so the multi-document transactions this app relies on (billing ↔ stock deduction)
work out of the box - a single standalone local `mongod` does not support transactions unless
it's initialized as a one-node replica set.

**Deploying:** backend to Render/Railway/EC2 (any Node host), frontend `npm run build` output
(`frontend/dist`) to any static host (Vercel/Netlify/S3). Set `CLIENT_ORIGIN` on the backend and
`VITE_API_BASE_URL` on the frontend to match your real URLs.

## 6. Verification performed in this environment

This sandbox has no access to the npm package registry, so `npm install` / a live `npm run dev`
could not be executed here. What *was* verified directly:

- The core arithmetic (`backend/utils/calc.js` - Amount = Qty × Rate, delivery note grand totals,
  and `remaining = opening + purchased - used`) is dependency-free and was run with plain Node:
  `node backend/utils/calc.test.js` → all assertions pass, including the exact examples from your
  spec (Steel 500 → used 85 → remaining 415; Cement 100 bags → delivered 20 → remaining 80).
- Every backend file passed `node --check` (syntax) and was confirmed to export every function
  its routes import (cross-checked programmatically, not just visually).
- Every frontend import path was confirmed to resolve to a real file.
- JSX/JS brace and parenthesis balance was verified across all 59 project files.

What this does **not** replace: running the real app against a real MongoDB instance and clicking
through it. Please run `npm install` in both folders per the Setup section above and use `npm run
seed` to sanity-check the demo data before handing this to staff.

## 7. Known caveats to review with RSA Construction

- The Tamil wording in `frontend/src/data/standardParticulars.js` (the 19 pre-printed Particulars)
  was transcribed from a photo of the pad; a few characters were hard to read (e.g. row 9 "Adjustment
  Sheet", row 15 "Column Pin"). Please proofread this file against the physical pad - it's the only
  place that text needs to be corrected.
- The small printed disclaimer/declaration lines on the pad were partially illegible in the photo;
  the print template includes a reasonable placeholder - swap the exact wording into
  `DeliveryNotePrint.jsx` (`dn-rental-note` / `dn-declaration`) once confirmed.
- Rental equipment (jacks, generator, scaffolding) reduces "stock" the same way a material sale
  does. If these are meant to be tracked as check-out/check-in rentals (returned later) rather than
  consumed materials, that's a different data model - flag it and it can be added as Phase 2.

## 8. Recent additions (theme, language, sidebar, Superadmin, AI assistant, charts, go-live script)

Beyond the original spec, the app now also has:

- **Light/dark theme** and **English/Tamil language switcher**, both in the sidebar footer,
  persisted per-browser (`ThemeContext`/`LanguageContext`).
- **Collapsible left sidebar** (desktop only) - click the `«`/`»` button at the top of the sidebar,
  or press **Ctrl+B** (Cmd+B on Mac) anywhere in the app. The mobile drawer always shows full
  labels regardless of this preference.
- **Dashboard charts** - a monthly revenue bar chart and a paid/pending donut chart, both plain
  inline SVG (no chart library dependency, so nothing new to `npm install`).
- **Superadmin panel** - lets you edit the Delivery Note Particulars list (the pre-printed
  No./Label rows) and the Material Category/Unit suggestion lists, without a code deploy. Reached
  by clicking the "R.S.A CONSTRUCTION" logo/name in the sidebar **5 times within 1.5 seconds**.
  Only visible/functional for a user whose `isSuperAdmin` flag is `true` (see below for how to set
  this on an existing account).
- **AI assistant widget** - a floating chat button, bottom-right, backed by the real Claude API
  (`backend/controllers/assistantController.js` → `POST /api/assistant/chat`). Requires you to set
  `ANTHROPIC_API_KEY` in the backend's environment (get one at console.anthropic.com - usage is
  billed to that Anthropic account). Without that key set, the widget still opens but shows a
  friendly "not configured yet" message instead of erroring.
- **Go-live cleanup script** (`backend/scripts/goLive.js`) - wipes demo customers, delivery notes,
  materials, and stock transactions while keeping Users and the Superadmin-managed Settings
  intact. Run once, right before real staff start using the app:
  ```bash
  cd backend
  node scripts/goLive.js            # dry run - prints what WOULD be deleted, deletes nothing
  node scripts/goLive.js --confirm  # actually deletes it
  ```
  (If invoking via `npm run go-live`, remember npm needs `--` before script flags:
  `npm run go-live -- --confirm`.)

### New environment variable

Add this to the **backend**'s environment (Render dashboard → your backend service → Environment,
or local `.env`) to enable the AI assistant widget - everything else works fine without it:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (leave blank to keep the assistant disabled) |
| `ANTHROPIC_MODEL` | Optional, defaults to `claude-3-5-haiku-20241022` |

### Granting Superadmin to an existing account (without re-seeding)

If you already have real data in production and don't want to run `npm run seed` again (which
wipes everything), grant yourself Superadmin directly in MongoDB Atlas instead:

1. Atlas → your cluster → **Browse Collections** → `rsa_construction` (or your DB name) → `users`.
2. Find your user document, click **Edit**.
3. Add a field: `isSuperAdmin` (type: Boolean) → `true`.
4. Save. Log out and back in to the app (so the new field is picked up), then click the sidebar
   logo 5 times.

New databases seeded from now on (`npm run seed`) already set `isSuperAdmin: true` on the seeded
admin account automatically, and pre-populate the Superadmin-editable Particulars/Category/Unit
lists - no manual step needed for a fresh setup.
