import pandas as pd
from io import StringIO

def read_csv(file):
    content = file.file.read().decode("utf-8")
    return pd.read_csv(StringIO(content))
