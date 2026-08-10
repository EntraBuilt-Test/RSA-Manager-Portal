const express = require('express');
const { protect } = require('../middleware/auth');
const { getWorkers, getWorker, createWorker, updateWorker, deleteWorker } = require('../controllers/workerController');

const router = express.Router();
router.use(protect);

router.get('/', getWorkers);
router.get('/:id', getWorker);
router.post('/', createWorker);
router.put('/:id', updateWorker);
router.delete('/:id', deleteWorker);

module.exports = router;
