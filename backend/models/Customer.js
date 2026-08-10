const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Customer name is required'], trim: true },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      // Indian mobile numbers: exactly 10 digits, starting 6-9. An optional
      // +91 / 91 country-code prefix is accepted but not required.
      validate: {
        validator: (v) => /^(?:\+?91[\-\s]?)?[6-9][0-9]{9}$/.test(String(v || '').trim()),
        message: 'Phone number must be a valid 10-digit Indian mobile number (e.g. 9876543210)',
      },
    },
    address: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

customerSchema.index({ name: 1, phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
