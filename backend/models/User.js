const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: { type: String, required: [true, 'Password is required'], minlength: 6, select: false },
    role: {
      type: String,
      enum: ['admin', 'manager', 'staff'],
      default: 'staff',
    },
    // Gates access to the hidden Superadmin panel (particulars/category/unit management).
    // Distinct from `role` so a normal admin account isn't automatically a superadmin -
    // this has to be set directly in the database for the first superadmin.
    isSuperAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const { _id, name, email, role, isSuperAdmin, createdAt } = this;
  return { id: _id, name, email, role, isSuperAdmin, createdAt };
};

module.exports = mongoose.model('User', userSchema);
