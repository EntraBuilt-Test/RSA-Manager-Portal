require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const deliveryNoteRoutes = require('./routes/deliveryNoteRoutes');
const materialRoutes = require('./routes/materialRoutes');
const stockRoutes = require('./routes/stockRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const assistantRoutes = require('./routes/assistantRoutes');
const workerRoutes = require('./routes/workerRoutes');
const labourRoutes = require('./routes/labourRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const customRecordRoutes = require('./routes/customRecordRoutes');
const superadminRoutes = require('./routes/superadminRoutes');

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// The Android app (Capacitor, see /android or the built .apk) serves its
// bundled UI from a fixed WebView origin - NOT whatever CLIENT_ORIGIN is set
// to on Render for the web frontend(s). Without these, every write from the
// mobile app (create worker, post a labour entry, ...) is silently blocked
// by CORS before it ever reaches a route handler: the browser/WebView never
// sends the request through, axios reports a generic network error, and the
// UI shows "Failed to save" with nothing in MongoDB - which looks exactly
// like "the site isn't storing data" from the user's side. These are fixed,
// well-known hybrid-app origins (not attacker-controllable), so allowing
// them unconditionally alongside CLIENT_ORIGIN is safe - auth here is a
// Bearer token in the Authorization header (see frontend/src/api/client.js),
// not cookies, so this isn't a CSRF surface.
const MOBILE_APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

// This one backend is shared by every deployed frontend (Admin Portal,
// Manager Portal, the Android app) - see the READMEs. CLIENT_ORIGIN on
// Render is almost always set to just ONE of them, so adding a new frontend
// deployment silently CORS-blocks all of its writes until someone remembers
// to append its URL to that env var too. Manager Portal hit exactly this -
// its origin was never in CLIENT_ORIGIN, so every save from
// rsa-manager-portal.onrender.com was being rejected before reaching a route
// handler. Listed here as a fixed, known first-party origin (not
// attacker-controllable) so it keeps working even if CLIENT_ORIGIN is never
// updated on Render - CLIENT_ORIGIN should still be kept in sync for
// clarity, this is just a safety net.
const KNOWN_FRONTEND_ORIGINS = ['https://rsa-manager-portal.onrender.com'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        MOBILE_APP_ORIGINS.includes(origin) ||
        KNOWN_FRONTEND_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/delivery-notes', deliveryNoteRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/labour', labourRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/records', customRecordRoutes);
app.use('/api/superadmin', superadminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const User = require('./models/User');
const { seed } = require('./seed/seed');

async function start() {
  await connectDB();
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('No users found in database. Seeding initial data...');
      await seed();
    }
  } catch (err) {
    console.error('Failed to run auto-seed check:', err.message);
  }
  app.listen(PORT, () => console.log(`RSA Construction API running on port ${PORT} [${process.env.NODE_ENV}]`));
}

if (require.main === module) {
  start();
}

module.exports = app;
