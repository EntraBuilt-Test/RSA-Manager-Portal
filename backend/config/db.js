const mongoose = require('mongoose');

let mongoServer;

// mongodb-memory-server is a devDependency (backend/package.json) - npm's
// default `omit` config is "dev" whenever NODE_ENV=production (which Render
// sets per DEPLOYMENT.md), so it is NOT installed on Render. Before this fix,
// a single slow Atlas handshake past the old 2s timeout - very plausible on
// a cold Render dyno - fell into the in-memory-Mongo branch below, which on
// Render throws MODULE_NOT_FOUND and calls process.exit(1), crashing the
// whole backend. That crash-loop is what "stuck on Loading... forever" on
// production (while localhost worked fine) almost certainly was. Production
// must never take that branch, and needs a connect budget sized for
// Atlas+Render cold starts rather than the 2s value that's fine for a local
// Mongo on localhost.
async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  if (process.env.NODE_ENV === 'production') {
    const attempts = 5;
    const delayMs = 5000;
    for (let i = 1; i <= attempts; i++) {
      try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
        console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
        return;
      } catch (err) {
        console.error(`MongoDB connection attempt ${i}/${attempts} failed: ${err.message}`);
        if (i < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    console.error('Could not connect to MongoDB after multiple attempts. Exiting.');
    process.exit(1);
    return;
  }

  try {
    // Attempt connecting with short timeout first so we don't hang if local mongodb is not running
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.log('Local MongoDB connection failed. Starting in-memory MongoDB server...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      const memoryUri = mongoServer.getUri();
      await mongoose.connect(memoryUri);
      console.log(`In-memory MongoDB started and connected: ${memoryUri}`);
    } catch (innerErr) {
      console.error('Failed to start in-memory MongoDB server:', innerErr.message);
      process.exit(1);
    }
  }
}

module.exports = connectDB;

