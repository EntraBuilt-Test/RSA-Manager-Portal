const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const { chat, proposeAction, executeAction } = require('../controllers/assistantController');

const router = express.Router();
router.use(protect);

// Basic anti-spam limit (this endpoint is now a free local keyword-matcher, no external
// API cost, but we still don't want someone hammering it).
const assistantLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.post('/chat', assistantLimiter, chat);

// Action mode - superadmin only, and split in two so that CONFIRMATION IS
// STRUCTURAL: /propose can only ever describe a change, and /execute is the
// only route that writes. A chat message alone can never mutate data, because
// the writing endpoint has to be called separately with an explicit action name.
router.post('/action/propose', assistantLimiter, requireSuperAdmin, proposeAction);
router.post('/action/execute', requireSuperAdmin, executeAction);

module.exports = router;
