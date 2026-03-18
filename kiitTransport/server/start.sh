#!/bin/bash

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI ML server in background on port 8000
python -m uvicorn ml.app.main:app --host 0.0.0.0 --port 8000 &

# Start Node.js main server
node server.js