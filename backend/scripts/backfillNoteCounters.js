/**
 * BACKFILL DELIVERY NOTE COUNTERS
 * -------------------------------
 * One-time fix for the "Duplicate value for field 'noteNumber'" bug.
 *
 * The old numbering logic generated the next note number by COUNTING existing
 * delivery notes for the year and adding 1. That breaks the moment any note is
 * ever deleted (the count drops, so the "next" number goes backwards into one
 * that's already taken) - which is exactly what happened here: DN-2026-0002 was
 * deleted at some point, leaving only DN-2026-0001 and DN-2026-0003 in the
 * database, so the old logic kept computing "2 notes exist -> next is 0003"
 * forever, colliding with the 0003 that already exists.
 *
 * The fix (backend/utils/generateNoteNumber.js) now uses an atomic Counter
 * document per year instead of counting. This script sets each year's counter
 * to the HIGHEST note number that actually exists in the database, so the very
 * next note created continues on from there (e.g. 0003 -> next is 0004) instead
 * of restarting from 1 and colliding again.
 *
 * Safe to run multiple times - it only ever moves a counter UP to match the
 * real data, never down, and never touches delivery notes themselves.
 *
 * Usage (from the backend/ folder, with a working MONGODB_URI in .env or
 * exported in the shell):
 *
 *   node scripts/backfillNoteCounters.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const DeliveryNote = require('../models/DeliveryNote');
const Counter = require('../models/Counter');

async function backfillNoteCounters() {
  await connectDB();

  const notes = await DeliveryNote.find({}, { noteNumber: 1 }).lean();

  if (notes.length === 0) {
    console.log('No delivery notes found - nothing to backfill.');
    await mongoose.disconnect();
    return;
  }

  // Group by year, tracking the highest seq seen per year, e.g. "DN-2026-0003" -> year 2026, seq 3.
  const maxSeqByYear = {};
  const pattern = /^DN-(\d{4})-(\d+)$/;

  for (const { noteNumber } of notes) {
    const match = pattern.exec(noteNumber || '');
    if (!match) {
      console.log(`Skipping note number that doesn't match the expected DN-YYYY-NNNN format: "${noteNumber}"`);
      continue;
    }
    const [, yearStr, seqStr] = match;
    const year = Number(yearStr);
    const seq = Number(seqStr);
    if (!maxSeqByYear[year] || seq > maxSeqByYear[year]) {
      maxSeqByYear[year] = seq;
    }
  }

  console.log('--------------------------------------------------');
  console.log('Highest existing note number found per year:');
  for (const [year, seq] of Object.entries(maxSeqByYear)) {
    console.log(`  ${year} -> DN-${year}-${String(seq).padStart(4, '0')} (seq ${seq})`);
  }
  console.log('--------------------------------------------------');

  for (const [year, seq] of Object.entries(maxSeqByYear)) {
    const key = `deliveryNote-${year}`;
    // $max only raises the counter, never lowers it - safe to re-run this script anytime.
    const result = await Counter.findOneAndUpdate(
      { _id: key },
      { $max: { seq } },
      { new: true, upsert: true }
    );
    console.log(`Counter "${key}" is now at seq ${result.seq}. Next note created for ${year} will be DN-${year}-${String(result.seq + 1).padStart(4, '0')}.`);
  }

  console.log('Done. The duplicate-note-number error should not happen again for these years.');
  await mongoose.disconnect();
}

backfillNoteCounters().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
