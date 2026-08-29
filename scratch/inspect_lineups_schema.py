import sqlite3

conn = sqlite3.connect(r"c:\Users\benoi\Documents\Predictor Ultimate\predictor_v2.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(fct_match_lineups);")
print("fct_match_lineups columns:", [r[1] for r in cursor.fetchall()])
conn.close()
