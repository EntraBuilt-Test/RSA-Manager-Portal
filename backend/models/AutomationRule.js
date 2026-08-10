const mongoose = require('mongoose');

/**
 * Configuration for the toggle-able rules on the Automation screen.
 *
 * These are CONFIGURATION, not code, and not a background job runner. Each
 * rule is evaluated on demand when the Superadmin Overview loads
 * (superadminController.evaluateAutomation), against live data. That keeps the
 * promise the Portal makes to the owner honest: turning a rule on changes what
 * the app flags for you, and it takes effect immediately, with no deploy and
 * no scheduler to babysit.
 *
 * The set of rule keys is fixed - a rule needs an evaluator function to mean
 * anything, and those live in code. Adding a genuinely new KIND of rule is the
 * one thing in this system that still needs a developer, which is exactly what
 * the build brief says to be explicit about.
 */
const automationRuleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    enabled: { type: Boolean, default: false },
    // Rule-specific settings, e.g. { days: 30 } for the overdue-payment rule.
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
