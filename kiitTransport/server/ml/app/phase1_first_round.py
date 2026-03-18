import pandas as pd
from datetime import datetime, timedelta
from io import StringIO


def phase1_first_round(file_content: str, buses: int, shuttles: int):
    BUS_CAPACITY = 60
    SHUTTLE_CAPACITY = 20
    BUS_THRESHOLD = 20          # demand > this → prefer bus
    BUS_TRIP_DURATION = 20      # minutes hostel → campus 25
    SHUTTLE_TRIP_DURATION = 15

    # ── Load & predict demand ──────────────────────────────
    df = pd.read_csv(StringIO(file_content))

    df["Students According to Section"] = (
        pd.to_numeric(df["Students According to Section"], errors="coerce")
        .fillna(0)
        .astype(int)
    )

    # Predicted = 90% of enrolled (realistic attendance)
    df["Predicted"] = (df["Students According to Section"] * 0.9).astype(int)

    demand = (
        df.groupby(["Hostels", "Class Start Time"])["Predicted"]
        .sum()
        .reset_index()
    )

    first_round_assignments = []
    hostel_summary = []
    vehicle_state = []

    # ── Process each class-start hour independently ────────
    for hour, hour_df in demand.groupby("Class Start Time"):
        hour = int(float(hour))
        time_slot = f"{hour:02d}:00"

        # Vehicles depart 30 min before class starts
        start_time = (datetime.strptime(str(hour), "%H") - timedelta(minutes=30)).strftime("%H:%M")
        end_time_bus     = (datetime.strptime(start_time, "%H:%M") + timedelta(minutes=BUS_TRIP_DURATION)).strftime("%H:%M")
        end_time_shuttle = (datetime.strptime(start_time, "%H:%M") + timedelta(minutes=SHUTTLE_TRIP_DURATION)).strftime("%H:%M")

        # Fresh vehicle pools for each hour
        buses_pool    = [{"id": f"BUS-{i+1:02d}",     "type": "Bus",     "used": False} for i in range(buses)]
        shuttles_pool = [{"id": f"SHUTTLE-{i+1:02d}", "type": "Shuttle", "used": False} for i in range(shuttles)]

        # hostel_state tracks remaining demand through all passes
        hostel_state = {
            row["Hostels"]: {
                "predicted": int(row["Predicted"]),
                "served":    0,
                "remaining": int(row["Predicted"]),
            }
            for _, row in hour_df.iterrows()
        }

        def get_free_bus():
            return next((b for b in buses_pool if not b["used"]), None)

        def get_free_shuttle():
            return next((s for s in shuttles_pool if not s["used"]), None)

        def assign_vehicle(vehicle, hostel, capacity, end_time):
            """Mark vehicle used, update hostel state, record assignment."""
            vehicle["used"] = True
            state = hostel_state[hostel]
            carried = min(capacity, state["remaining"])
            state["served"]    += carried
            state["remaining"] -= carried

            first_round_assignments.append({
                "vehicle_id":        vehicle["id"],
                "vehicle_type":      vehicle["type"],
                "round":             1,
                "hostel":            hostel,
                "time_slot":         time_slot,
                "predicted_students": state["predicted"],
                "students_assigned": carried,
                "capacity_used":     carried,
                "capacity_total":    capacity,
                "start_time":        start_time,
                "end_time":          end_time,
            })

        # ══════════════════════════════════════════════════
        # PASS 1 — One vehicle guaranteed per hostel
        #   Rule: demand > 20 → assign Bus; else → assign Shuttle
        #   If preferred type is exhausted, fall back to the other.
        # ══════════════════════════════════════════════════
        # Sort hostels by demand descending so high-demand ones get buses first
        sorted_hostels = sorted(hostel_state.keys(), key=lambda h: hostel_state[h]["remaining"], reverse=True)

        for hostel in sorted_hostels:
            demand_now = hostel_state[hostel]["remaining"]

            if demand_now > BUS_THRESHOLD:
                # Prefer bus
                vehicle = get_free_bus()
                if vehicle:
                    assign_vehicle(vehicle, hostel, BUS_CAPACITY, end_time_bus)
                    continue
                # Bus exhausted — fall back to shuttle
                vehicle = get_free_shuttle()
                if vehicle:
                    assign_vehicle(vehicle, hostel, SHUTTLE_CAPACITY, end_time_shuttle)
                    continue
            else:
                # Prefer shuttle
                vehicle = get_free_shuttle()
                if vehicle:
                    assign_vehicle(vehicle, hostel, SHUTTLE_CAPACITY, end_time_shuttle)
                    continue
                # Shuttle exhausted — fall back to bus
                vehicle = get_free_bus()
                if vehicle:
                    assign_vehicle(vehicle, hostel, BUS_CAPACITY, end_time_bus)
                    continue
            # No vehicles left at all — hostel stays unserved in this pass

        # ══════════════════════════════════════════════════
        # PASS 2 — Use ALL remaining vehicles optimally
        #   Keep assigning until no vehicles left OR all demand met.
        #   Same rule: remaining > 20 → bus preferred; else → shuttle.
        #   Re-sort hostels by remaining demand before each assignment
        #   so the most overcrowded hostel always gets the next vehicle.
        # ══════════════════════════════════════════════════
        while True:
            # Find hostels still needing service
            needy = [(h, hostel_state[h]) for h in hostel_state if hostel_state[h]["remaining"] > 0]
            if not needy:
                break

            # Any free vehicles left?
            free_bus     = get_free_bus()
            free_shuttle = get_free_shuttle()
            if not free_bus and not free_shuttle:
                break

            # Pick hostel with highest remaining demand
            needy.sort(key=lambda x: x[1]["remaining"], reverse=True)
            hostel, state = needy[0]
            demand_now = state["remaining"]

            if demand_now > BUS_THRESHOLD:
                vehicle = free_bus
                if vehicle:
                    assign_vehicle(vehicle, hostel, BUS_CAPACITY, end_time_bus)
                    continue
                # No bus — use shuttle instead
                vehicle = free_shuttle
                if vehicle:
                    assign_vehicle(vehicle, hostel, SHUTTLE_CAPACITY, end_time_shuttle)
                    continue
            else:
                vehicle = free_shuttle
                if vehicle:
                    assign_vehicle(vehicle, hostel, SHUTTLE_CAPACITY, end_time_shuttle)
                    continue
                # No shuttle — use bus instead
                vehicle = free_bus
                if vehicle:
                    assign_vehicle(vehicle, hostel, BUS_CAPACITY, end_time_bus)
                    continue

            break  # Safety exit

        # ── Build summary & vehicle state for Phase 2 ─────
        for hostel, state in hostel_state.items():
            hostel_summary.append({
                "hostel":                     hostel,
                "time_slot":                  time_slot,
                "predicted_students":         state["predicted"],
                "served_in_first_round":      state["served"],
                "remaining_after_first_round": state["remaining"],
                "status_after_round_1": (
                    "Fully Served"    if state["remaining"] == 0  else
                    "Partially Served" if state["served"]   > 0  else
                    "Not Served"
                ),
            })

        # Vehicles become available again after their trip ends
        for vehicle in buses_pool + shuttles_pool:
            if vehicle["used"]:
                end_t = end_time_bus if vehicle["type"] == "Bus" else end_time_shuttle
                vehicle_state.append({
                    "vehicle_id":         vehicle["id"],
                    "vehicle_type":       vehicle["type"],
                    "time_slot":          time_slot,
                    "rounds_completed":   1,
                    "available_from_time": end_t,   # free at t-10 (bus: t-30+20 = t-10)
                    "can_do_second_round": True,
                })

    return {
        "result": {
            "first_round_assignments":      first_round_assignments,
            "hostel_first_round_summary":   hostel_summary,
            "vehicle_state_after_round_1":  vehicle_state,
        }
    }