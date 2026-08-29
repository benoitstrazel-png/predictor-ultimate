import sqlite3

conn = sqlite3.connect(r"c:\Users\benoi\Documents\Predictor Ultimate\predictor_v2.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(fact_matches);")
print("fact_matches columns:", [r[1] for r in cursor.fetchall()])

cursor.execute("SELECT * FROM fact_matches LIMIT 2;")
print(cursor.fetchall())
conn.close()
