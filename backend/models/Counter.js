const mongoose = require('mongoose');

/**
 * Generic atomic counter, one document per named sequence
 * (e.g. _id: "deliveryNote-2026" -> { seq: 3 }).
 *
 * Used instead of "count existing documents + 1" because counting breaks the
 * moment any document is deleted or two requests arrive at nearly the same
 * time - both would compute the same "next" number and collide. An atomic
 * $inc on a single counter document can never hand out the same number twice.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
