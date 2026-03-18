// ─────────────────────────────────────────────────────────────
// Shared helpers for reading ML allocation from sessionStorage
// Used by Vehicles.jsx and Hostels.jsx
// ─────────────────────────────────────────────────────────────

export const ML_STORAGE_KEY = "kiit_ml_allocation";

/** Parse "HH:MM" into total minutes since midnight */
export function toMinutes(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/** Current time in minutes since midnight */
export function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/**
 * Given all assignments (phase1 + phase2 combined), find the one
 * that is currently active for a given vehicle.
 *
 * A trip is "active" when: start_time <= now < end_time
 * If nothing is active right now, return the NEXT upcoming trip.
 * If nothing upcoming, return null.
 */
export function getActiveAssignmentForVehicle(assignments, vehicleId) {
  const now = nowMinutes();

  const mine = assignments.filter(a => a.vehicle_id === vehicleId);
  if (!mine.length) return null;

  // 1. Currently active (now is within the trip window)
  const active = mine.find(a => {
    const start = toMinutes(a.start_time);
    const end   = toMinutes(a.end_time ?? a.arrival_time);
    return start !== null && end !== null && now >= start && now < end;
  });
  if (active) return { ...active, status: "active" };

  // 2. Next upcoming trip (starts after now, pick the soonest)
  const upcoming = mine
    .filter(a => toMinutes(a.start_time) > now)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (upcoming.length) return { ...upcoming[0], status: "upcoming" };

  // 3. Most recent past trip (bus finished all trips today)
  const past = mine
    .filter(a => toMinutes(a.start_time) <= now)
    .sort((a, b) => toMinutes(b.start_time) - toMinutes(a.start_time));
  if (past.length) return { ...past[0], status: "done" };

  return null;
}

/**
 * Build a normalised flat list of all assignments from ML data.
 * Adds a `hostel` field uniformly (phase1 uses `hostel`, phase2 uses `to_hostel`).
 */
export function getAllAssignments(mlData) {
  if (!mlData) return [];
  const p1 = (mlData.phase1?.first_round_assignments ?? []).map(a => ({
    ...a,
    hostel: a.hostel,
    end_time: a.end_time,
  }));
  const p2 = (mlData.phase2?.second_round_assignments ?? []).map(a => ({
    ...a,
    hostel: a.to_hostel,
    end_time: a.arrival_time,
  }));
  return [...p1, ...p2];
}

/**
 * For the Hostels page: build a per-hostel summary keyed by time_slot.
 * Each slot carries { predicted, served, remaining, activeVehicles }.
 */
export function buildHostelTimelineMap(mlData) {
  if (!mlData?.phase1) return {};

  const p1Summary     = mlData.phase1.hostel_first_round_summary ?? [];
  const p2Summary     = mlData.phase2?.hostel_second_round_summary ?? [];
  const allAssign     = getAllAssignments(mlData);

  // Map: hostelName → { slotMap: { "09:00": { predicted, served, remaining, vehicles[] } } }
  const hostelMap = {};

  for (const item of p1Summary) {
    if (!hostelMap[item.hostel]) hostelMap[item.hostel] = { slots: {} };
    hostelMap[item.hostel].slots[item.time_slot] = {
      predicted:  item.predicted_students,
      served:     item.served_in_first_round,
      remaining:  item.remaining_after_first_round,
      start_time: null,
      end_time:   null,
      vehicles:   [],
    };
  }

  // Patch remaining counts from phase2 final summary (applies to all slots combined)
  // Phase2 only gives totals, so we just annotate the hostel level
  const p2Totals = {};
  for (const item of p2Summary) {
    p2Totals[item.hostel] = { remaining: item.remaining_students, served: item.total_served };
  }

  // Attach vehicle + timing info to each slot
  for (const a of allAssign) {
    const entry = hostelMap[a.hostel]?.slots[a.time_slot];
    if (entry) {
      entry.vehicles.push(a.vehicle_id);
      if (!entry.start_time) entry.start_time = a.start_time;
      if (!entry.end_time)   entry.end_time   = a.end_time;
    }
  }

  // Build final structure
  return Object.entries(hostelMap).map(([hostel, { slots }]) => {
    const slotList = Object.entries(slots)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slot, data]) => ({ slot, ...data, vehicles: [...new Set(data.vehicles)] }));

    const totalPredicted = slotList.reduce((s, x) => s + x.predicted, 0);
    const p2 = p2Totals[hostel];
    const totalServed    = p2?.served    ?? slotList.reduce((s, x) => s + x.served, 0);
    const totalRemaining = p2?.remaining ?? slotList.reduce((s, x) => s + x.remaining, 0);

    return { hostel, slotList, totalPredicted, totalServed, totalRemaining };
  });
}

/**
 * Find the currently-relevant slot for a hostel's slot list.
 * A slot is "active" if now is within [start_time, end_time].
 * Falls back to next upcoming, then first slot.
 */
export function getActiveSlot(slotList) {
  if (!slotList?.length) return null;
  const now = nowMinutes();

  // Active right now
  const active = slotList.find(s => {
    const start = toMinutes(s.start_time);
    const end   = toMinutes(s.end_time);
    return start !== null && end !== null && now >= start && now < end;
  });
  if (active) return { ...active, isCurrent: true };

  // Upcoming
  const upcoming = slotList
    .filter(s => toMinutes(s.start_time) > now)
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  if (upcoming.length) return { ...upcoming[0], isCurrent: false };

  // Most recent past
  return { ...slotList[slotList.length - 1], isCurrent: false };
}