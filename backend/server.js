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
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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
