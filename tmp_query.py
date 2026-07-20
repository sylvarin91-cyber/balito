import sqlite3

DB_PATH = r"C:\Users\ByulyantHasanovHCM-M\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== TABLES ===")
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
for row in c.fetchall():
    print(f"  {row[0]}")

print("\n=== SESSIONS (all) ===")
try:
    c.execute("SELECT * FROM session ORDER BY time_created DESC LIMIT 20")
    cols = [d[0] for d in c.description]
    for row in c.fetchall():
        print(f"  {dict(row)}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== MESSAGES (recent 10) ===")
try:
    c.execute("SELECT id, session_id, agent_id, time_created, substr(data,1,200) as preview FROM message ORDER BY time_created DESC LIMIT 10")
    for row in c.fetchall():
        print(f"  {dict(row)}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== PARTS (recent 5) ===")
try:
    c.execute("SELECT id, message_id, session_id, time_created, substr(data,1,300) as preview FROM part ORDER BY time_created DESC LIMIT 5")
    for row in c.fetchall():
        print(f"  {dict(row)}")
except Exception as e:
    print(f"  Error: {e}")

conn.close()
