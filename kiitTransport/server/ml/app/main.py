from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from .phase1_first_round import phase1_first_round
from .phase2_reassignment import phase2_reassignment

app = FastAPI(
    title="Transport Allocation Engine",
    description="Phase-1 + Phase-2 Combined Execution",
    version="3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://kiit-transport-app.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "running", "available_endpoints": ["/api/ml/run-all", "/api/ml/fleet-analysis"]}


# ─────────────────────────────────────────────────────────────
# RUN PHASE 1 + PHASE 2 (main simulation)
# ─────────────────────────────────────────────────────────────
@app.post("/api/ml/run-all")
async def run_full_allocation(
    buses: int = Form(...),
    shuttles: int = Form(...),
    file: UploadFile = File(...)
):
    file_content = (await file.read()).decode("utf-8")

    phase1_result = phase1_first_round(file_content=file_content, buses=buses, shuttles=shuttles)
    phase1_clean  = phase1_result.get("result", {})
    phase2_result = phase2_reassignment(phase1_clean)

    bus_timetable = []

    for item in phase1_clean.get("first_round_assignments", []):
        bus_timetable.append({
            "vehicle_id":        item["vehicle_id"],
            "vehicle_type":      item["vehicle_type"],
            "round":             1,
            "to_hostel":         item["hostel"],
            "time_slot":         item["time_slot"],
            "start_time":        item["start_time"],
            "end_time":          item["end_time"],
            "students_assigned": item["students_assigned"],
        })

    for item in phase2_result.get("second_round_assignments", []):
        bus_timetable.append({
            "vehicle_id":        item["vehicle_id"],
            "vehicle_type":      item["vehicle_type"],
            "round":             2,
            "to_hostel":         item["to_hostel"],
            "time_slot":         item["time_slot"],
            "start_time":        item["start_time"],
            "end_time":          item["arrival_time"],
            "students_assigned": item["students_assigned"],
        })

    bus_timetable.sort(key=lambda x: (x["vehicle_id"], x["start_time"]))

    return {
        "result": {
            "phase1":        phase1_clean,
            "phase2":        phase2_result,
            "bus_timetable": bus_timetable,
        }
    }


# ─────────────────────────────────────────────────────────────
# FLEET ANALYSIS — run simulation across multiple bus counts
# and return serve rates so the frontend can show the table
# ─────────────────────────────────────────────────────────────
@app.post("/api/ml/fleet-analysis")
async def fleet_analysis(
    shuttles: int = Form(...),
    file: UploadFile = File(...)
):
    file_content = (await file.read()).decode("utf-8")

    # Calculate total demand from the CSV first
    import pandas as pd
    from io import StringIO

    df = pd.read_csv(StringIO(file_content))
    df["Students According to Section"] = (
        pd.to_numeric(df["Students According to Section"], errors="coerce")
        .fillna(0)
        .astype(int)
    )
    df["Predicted"] = (df["Students According to Section"] * 0.9).astype(int)
    total_demand = int(df["Predicted"].sum())

    # Run simulation for increasing bus counts until 100% served or cap reached
    results = []
    prev_remaining = None
    max_buses = 30  # safety cap

    bus_count = 1
    while bus_count <= max_buses:
        p1 = phase1_first_round(file_content=file_content, buses=bus_count, shuttles=shuttles)["result"]
        p2 = phase2_reassignment(p1)

        total_served    = sum(s["total_served"]        for s in p2["hostel_second_round_summary"])
        total_remaining = sum(s["remaining_students"]  for s in p2["hostel_second_round_summary"])
        serve_pct       = round(total_served / max(total_demand, 1) * 100, 1)

        # Phase 1 only stats (to show Phase 2 contribution)
        p1_only_remaining = sum(s["remaining_after_first_round"] for s in p1["hostel_first_round_summary"])
        p1_only_served    = total_demand - p1_only_remaining
        p2_contribution   = total_served - p1_only_served

        trend = None
        if prev_remaining is not None:
            if total_remaining < prev_remaining:
                trend = "improving"
            elif total_remaining == prev_remaining:
                trend = "saturated"
            else:
                trend = "worse"

        results.append({
            "buses":            bus_count,
            "shuttles":         shuttles,
            "total_demand":     total_demand,
            "p1_served":        p1_only_served,
            "p2_contribution":  p2_contribution,
            "total_served":     total_served,
            "remaining":        total_remaining,
            "serve_pct":        serve_pct,
            "trend":            trend,
            "is_optimal":       False,  # will mark below
        })

        prev_remaining = total_remaining

        # Stop once fully served
        if total_remaining == 0:
            break

        # Increment: smaller steps at low counts, bigger at high
        if bus_count < 10:
            bus_count += 1
        elif bus_count < 20:
            bus_count += 2
        else:
            bus_count += 5

    # Mark the minimum buses needed for 100% as optimal
    fully_served = [r for r in results if r["remaining"] == 0]
    if fully_served:
        fully_served[0]["is_optimal"] = True

    return {
        "total_demand": total_demand,
        "results":      results,
        "min_buses_for_full_coverage": fully_served[0]["buses"] if fully_served else None,
    }