import sqlite3

conn = sqlite3.connect('predictor_v2.db')
c = conn.cursor()

print("=== Ligue 1 2025-2026 Round 34 in SQLite ===")
c.execute("SELECT home_team_name, away_team_name, home_score, away_score, match_date, referee_name FROM fact_matches WHERE competition_id='FRA-L1' AND season='2025-2026' AND round_label='34' ORDER BY match_date, home_team_name")
for row in c.fetchall():
    print(f"  {row[0]:<20} {row[2]}-{row[3]} {row[1]:<20} | {row[4]} | {row[5]}")

print("\n=== Premier League 2025-2026 Round 38 in SQLite ===")
c.execute("SELECT home_team_name, away_team_name, home_score, away_score, match_date, referee_name FROM fact_matches WHERE competition_id='ENG-PL' AND season='2025-2026' AND round_label='38' ORDER BY match_date, home_team_name")
for row in c.fetchall():
    print(f"  {row[0]:<20} {row[2]}-{row[3]} {row[1]:<20} | {row[4]} | {row[5]}")

print("\n=== Serie A 2025-2026 Round 38 in SQLite ===")
c.execute("SELECT home_team_name, away_team_name, home_score, away_score, match_date, referee_name FROM fact_matches WHERE competition_id='ITA-SA' AND season='2025-2026' AND round_label='38' ORDER BY match_date, home_team_name")
for row in c.fetchall():
    print(f"  {row[0]:<20} {row[2]}-{row[3]} {row[1]:<20} | {row[4]} | {row[5]}")

print("\n=== Bundesliga 2025-2026 Round 34 in SQLite ===")
c.execute("SELECT home_team_name, away_team_name, home_score, away_score, match_date, referee_name FROM fact_matches WHERE competition_id='GER-BL' AND season='2025-2026' AND round_label='34' ORDER BY match_date, home_team_name")
for row in c.fetchall():
    print(f"  {row[0]:<20} {row[2]}-{row[3]} {row[1]:<20} | {row[4]} | {row[5]}")

conn.close()
