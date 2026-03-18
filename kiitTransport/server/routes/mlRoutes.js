import express from 'express';
import { runPhase1, runPhase2, runFullSimulation, upload } from '../controllers/mlController.js';

const router = express.Router();

router.post('/phase1', upload.single('file'), runPhase1);
router.post('/phase2', runPhase2);

// Primary endpoint: runs both phases and persists result for dashboard
router.post('/run-all', upload.single('file'), runFullSimulation);

export default router;