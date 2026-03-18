import multer from 'multer';
import { setLatestAllocation } from '../utils/mlState.js';
import { syncFleetStatusInternal } from '../utils/fleetSync.js';

const storage = multer.memoryStorage();
export const upload = multer({ storage });

export const runPhase1 = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { buses, shuttles } = req.body;

        const formData = new FormData();
        formData.append('buses', buses);
        formData.append('shuttles', shuttles);

        const fileBlob = new Blob([req.file.buffer], {
            type: req.file.mimetype
        });

        formData.append('file', fileBlob, req.file.originalname);

        const response = await fetch('http://127.0.0.1:8000/api/ml/phase1', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Phase1 Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const runPhase2 = async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/ml/phase2', {
            method: 'POST'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Phase2 Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ── Run Full Simulation (Phase 1 + Phase 2) ──────────────────────
// This is the primary endpoint called from MLPredictions.jsx
// It stores the combined result in mlState for Vehicles & Hostels pages
export const runFullSimulation = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { buses, shuttles } = req.body;

        const formData = new FormData();
        formData.append('buses', buses);
        formData.append('shuttles', shuttles);

        const fileBlob = new Blob([req.file.buffer], {
            type: req.file.mimetype
        });
        formData.append('file', fileBlob, req.file.originalname);

        const response = await fetch('http://127.0.0.1:8000/api/ml/run-all', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        // ── Persist allocation so Vehicles & Hostels pages can read it ──
        setLatestAllocation(data);

        // ── Auto-sync fleet status in DB ──────────────────────────────
        // Count distinct ML vehicle IDs per type so we know exactly how
        // many real DB buses should be marked active vs idle.
        try {
            const allAsgn     = [
                ...(data.result?.phase1?.first_round_assignments ?? []),
                ...(data.result?.phase2?.second_round_assignments ?? []),
            ]
            // Count distinct ML vehicle IDs (all treated as buses — no vehicle_type column in DB)
            const mlBusIds = new Set(allAsgn.map(a => a.vehicle_id))
            await syncFleetStatusInternal(mlBusIds.size)
        } catch (syncErr) {
            // Non-fatal — log but don't fail the response
            console.warn('Fleet status sync failed (non-fatal):', syncErr.message)
        }

        res.json(data);

    } catch (error) {
        console.error("Full Simulation Error:", error);
        res.status(500).json({ error: error.message });
    }
};