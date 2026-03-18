import pandas as pd

def predict_bus_demand(df):
    df = df.copy()

    df["Class Start Time"] = (
        df["Class Start Time"]
        .replace("NA", pd.NA)
        .dropna()
        .astype(int)
    )

    df["Students According to Section"] = pd.to_numeric(
        df["Students According to Section"], errors="coerce"
    ).fillna(0)

    df["Bus Capacity"] = pd.to_numeric(
        df["Bus Capacity"], errors="coerce"
    ).fillna(0)

    summary = (
        df.groupby(["Hostels", "Class Start Time"])
        .agg({
            "Students According to Section": "sum",
            "Alloted Bus No.": "first",
            "Bus Capacity": "first"
        })
        .reset_index()
    )

    summary = summary[summary["Bus Capacity"] > 0]

    return summary
