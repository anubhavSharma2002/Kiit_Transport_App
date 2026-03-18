from datetime import datetime, timedelta
from collections import defaultdict
import copy


def phase2_reassignment(phase1_output):
    """
    Phase 2 — Second round using vehicles freed after Phase 1.

    Timeline per time_slot (class at HH:00):
      - Phase 1 departs at HH-30, arrives campus at HH-10  (bus: 20 min trip)
      - Phase 2 can depart from HH-10 onward              (available_from_time)
      - Phase 2 arrives campus at HH-10+20 = HH+10        (still before next hour)

    Same allocation rules as Phase 1:
      - remaining demand > 20  → prefer Bus  (capacity 60)
      - remaining demand ≤ 20  → prefer Shuttle (capacity 20)
      - fall back to other type if preferred is unavailable
      - keep assigning until no demand OR no vehicles for this time slot
    """

    BUS_CAPACITY     = 60
    SHUTTLE_CAPACITY = 20
    BUS_THRESHOLD    = 20
    BUS_TRIP_DURATION     = 20  # minutes
    SHUTTLE_TRIP_DURATION = 15

    # Deep copy so we don't mutate Phase 1 output
    hostel_summary = copy.deepcopy(phase1_output["hostel_first_round_summary"])
    vehicle_state  = copy.deepcopy(phase1_output["vehicle_state_after_round_1"])

    second_round_assignments = []

    # ── Group hostels and vehicles by time_slot ────────────
    hostels_by_slot  = defaultdict(list)
    vehicles_by_slot = defaultdict(list)

    for h in hostel_summary:
        if h["remaining_after_first_round"] > 0:
            hostels_by_slot[h["time_slot"]].append(h)

    for v in vehicle_state:
        if v["can_do_second_round"]:
            vehicles_by_slot[v["time_slot"]].append(v)

    # ── Process each time slot ─────────────────────────────
    for time_slot, hostels in hostels_by_slot.items():
        # Available vehicles for this slot (freed after Phase 1 trip)
        available_vehicles = vehicles_by_slot.get(time_slot, [])

        # Separate into buses and shuttles pools (each vehicle used once)
        free_buses    = [v for v in available_vehicles if v["vehicle_type"] == "Bus"]
        free_shuttles = [v for v in available_vehicles if v["vehicle_type"] == "Shuttle"]

        def get_free_bus():
            return next((v for v in free_buses if not v.get("used_p2")), None)

        def get_free_shuttle():
            return next((v for v in free_shuttles if not v.get("used_p2")), None)

        # ══════════════════════════════════════════════════
        # Same greedy loop as Phase 1 Pass 2:
        #   Sort by remaining demand → assign preferred vehicle → repeat
        # ══════════════════════════════════════════════════
        while True:
            # Hostels still needing service this slot
            needy = [h for h in hostels if h["remaining_after_first_round"] > 0]
            if not needy:
                break

            bus     = get_free_bus()
            shuttle = get_free_shuttle()
            if not bus and not shuttle:
                break

            # Highest remaining demand first
            needy.sort(key=lambda x: x["remaining_after_first_round"], reverse=True)
            hostel = needy[0]
            remaining = hostel["remaining_after_first_round"]

            selected = None
            capacity = 0
            trip_duration = 0

            if remaining > BUS_THRESHOLD:
                if bus:
                    selected, capacity, trip_duration = bus, BUS_CAPACITY, BUS_TRIP_DURATION
                elif shuttle:
                    selected, capacity, trip_duration = shuttle, SHUTTLE_CAPACITY, SHUTTLE_TRIP_DURATION
            else:
                if shuttle:
                    selected, capacity, trip_duration = shuttle, SHUTTLE_CAPACITY, SHUTTLE_TRIP_DURATION
                elif bus:
                    selected, capacity, trip_duration = bus, BUS_CAPACITY, BUS_TRIP_DURATION

            if not selected:
                break

            # Mark used in Phase 2
            selected["used_p2"] = True

            carried      = min(capacity, remaining)
            start_time   = selected["available_from_time"]
            arrival_time = (
                datetime.strptime(start_time, "%H:%M") + timedelta(minutes=trip_duration)
            ).strftime("%H:%M")

            second_round_assignments.append({
                "vehicle_id":    selected["vehicle_id"],
                "vehicle_type":  selected["vehicle_type"],
                "round":         2,
                "to_hostel":     hostel["hostel"],
                "time_slot":     time_slot,
                "students_assigned": carried,
                "capacity_used": carried,
                "capacity_total": capacity,
                "start_time":    start_time,
                "arrival_time":  arrival_time,
            })

            hostel["remaining_after_first_round"] -= carried

    # ── Final summary after both phases ───────────────────
    hostel_final_summary = []

    for hostel in hostel_summary:
        # remaining_after_first_round now reflects Phase 2 reductions too
        remaining = hostel["remaining_after_first_round"]
        predicted = hostel["predicted_students"]
        total_served = predicted - remaining

        hostel_final_summary.append({
            "hostel":            hostel["hostel"],
            "time_slot":         hostel["time_slot"],
            "predicted_students": predicted,
            "total_served":      total_served,
            "remaining_students": remaining,
            "final_status": (
                "Fully Served"    if remaining == 0             else
                "Partially Served" if total_served > 0          else
                "Not Served"
            ),
        })

    return {
        "second_round_assignments":    second_round_assignments,
        "hostel_second_round_summary": hostel_final_summary,
    }