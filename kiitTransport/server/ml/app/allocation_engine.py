# import pandas as pd
# from datetime import datetime, timedelta
# from io import StringIO

# def run_allocation(file_content: str, buses: int, shuttles: int):
#     bus_capacity = 60
#     shuttle_capacity = 20

#     second_round_threshold = 20
#     round_time_hours = 1

#     df = pd.read_csv(StringIO(file_content))

#     df["Students According to Section"] = (
#         pd.to_numeric(df["Students According to Section"], errors="coerce")
#         .fillna(0)
#         .astype(int)
#     )

#     df["Predicted"] = (df["Students According to Section"] * 0.9).astype(int)

#     summary = (
#         df.groupby(["Hostels", "Class Start Time"])["Predicted"]
#         .sum()
#         .reset_index()
#         .sort_values("Class Start Time")
#     )

#     buses_pool = [{"id": f"B{i+1}", "free_at": 0} for i in range(buses)]
#     shuttles_pool = [{"id": f"S{i+1}", "free_at": 0} for i in range(shuttles)]

#     records = []

#     for _, row in summary.iterrows():
#         hostel = row["Hostels"]
#         students = int(row["Predicted"])
#         hour = int(float(row["Class Start Time"]))

#         arrival_time = (
#             datetime.strptime(str(hour), "%H") - timedelta(minutes=30)
#         ).strftime("%H:%M")

#         buses_used = []
#         shuttles_used = []

#         remaining = students

#         # 🚌 FIRST ROUND BUS (if students ≥ 20)
#         if students >= 20:
#             for bus in buses_pool:
#                 if bus["free_at"] <= hour:
#                     buses_used.append(bus["id"])
#                     bus["free_at"] = hour + round_time_hours
#                     carried = min(bus_capacity, remaining)
#                     remaining -= carried
#                     break

#         # 🚌 SECOND ROUND (ONLY IF EFFICIENT)
#         if buses_used and remaining >= second_round_threshold:
#             carried = min(bus_capacity, remaining)
#             remaining -= carried

#         # 🚐 SHUTTLE FOR LEFTOVER
#         if remaining > 0:
#             for shuttle in shuttles_pool:
#                 if shuttle["free_at"] <= hour:
#                     shuttles_used.append(shuttle["id"])
#                     shuttle["free_at"] = hour + round_time_hours
#                     carried = min(shuttle_capacity, remaining)
#                     remaining -= carried
#                     break

#         total_capacity = (
#             len(buses_used) * bus_capacity +
#             (bus_capacity if buses_used and students - bus_capacity >= second_round_threshold else 0) +
#             len(shuttles_used) * shuttle_capacity
#         )

#         if total_capacity < students:
#             status = "Overcrowded"
#             message = f"{students - total_capacity} students waiting – no efficient second round"
#         elif total_capacity > students:
#             status = "Undercrowded"
#             message = f"{total_capacity - students} seats unused"
#         else:
#             status = "Perfectly Assigned"
#             message = "Capacity exactly matches demand"

#         records.append({
#             "Hostel": hostel,
#             "Day": "Weekday",
#             "Time": hour,
#             "Predicted Students": students,
#             "Buses Used": buses_used,
#             "Shuttles Used": shuttles_used,
#             "Total Capacity": total_capacity,
#             "Arrival Time": arrival_time,
#             "Status": status,
#             "Message": message,
#             "Rule Applied": "Bus first round if ≥20, second round only if ≥20"
#         })

#     return {
#         "assigned_transport": records
#     }
