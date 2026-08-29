import sqlite3

conn = sqlite3.connect(r"c:\Users\benoi\Documents\Predictor Ultimate\predictor_v2.db")
cursor = conn.cursor()
cursor.execute("SELECT match_id, date, season, league_id, home_team_id, away_team_id FROM fact_matches LIMIT 5;")
for r in cursor.fetchall():
    print(r)
cursor.execute("SELECT COUNT(*) FROM fact_matches;")
print("Total matches in fact_matches:", cursor.fetchone()[0])
conn.close()
