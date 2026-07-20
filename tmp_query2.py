import sqlite3, json

DB_PATH = r"C:\Users\ByulyantHasanovHCM-M\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Get all sessions for this project
PROJECT_ID = "5c23c5a0-56db-4cb6-bf5b-672dbe7116ad"

print("=== PROJECT SESSIONS (sorted by time) ===")
c.execute("SELECT id, title, time_created, summary_additions, summary_files FROM session WHERE project_id = ? ORDER BY time_created", (PROJECT_ID,))
for row in c.fetchall():
    print(f"  {row['id']}: {row['title'][:80]} (additions={row['summary_additions']}, files={row['summary_files']})")

# Check the "Login, sign up, magic link not working" session
LOGIN_SESSION = "ses_09b912051ffehq4ARyAj25Y0ty"
print(f"\n=== MESSAGES IN LOGIN SESSION ({LOGIN_SESSION}) ===")
c.execute("""
    SELECT m.id, m.agent_id, json_extract(m.data, '$.role') as role, m.time_created,
           substr(json_extract(m.data, '$.summary'), 1, 500) as summary_preview
    FROM message m
    WHERE m.session_id = ?
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  {row['id']}: role={row['role']}, agent={row['agent_id']}, time={row['time_created']}")
    if row['summary_preview']:
        try:
            s = json.loads(row['summary_preview']) if row['summary_preview'].startswith('{') else row['summary_preview']
            if isinstance(s, dict):
                print(f"    summary: {json.dumps(s, indent=2)[:300]}")
            else:
                print(f"    summary: {str(s)[:300]}")
        except:
            print(f"    summary: {str(row['summary_preview'])[:300]}")

# Check the "Lost context from last prompt" session
LOST_SESSION = "ses_09aeff9e8ffeXpZf9Jn9ppE4NK"
print(f"\n=== MESSAGES IN LOST CONTEXT SESSION ({LOST_SESSION}) ===")
c.execute("""
    SELECT m.id, m.agent_id, json_extract(m.data, '$.role') as role, m.time_created,
           substr(json_extract(m.data, '$.summary'), 1, 500) as summary_preview
    FROM message m
    WHERE m.session_id = ?
    ORDER BY m.time_created
""", (LOST_SESSION,))
for row in c.fetchall():
    print(f"  {row['id']}: role={row['role']}, agent={row['agent_id']}, time={row['time_created']}")
    if row['summary_preview']:
        try:
            s = json.loads(row['summary_preview']) if row['summary_preview'].startswith('{') else row['summary_preview']
            if isinstance(s, dict):
                print(f"    summary: {json.dumps(s, indent=2)[:300]}")
            else:
                print(f"    summary: {str(s)[:300]}")
        except:
            print(f"    summary: {str(row['summary_preview'])[:300]}")

# Check parts with text content for key decisions/rules
print(f"\n=== TEXT PARTS IN LOGIN SESSION (assistant turns, first 15) ===")
c.execute("""
    SELECT p.id, p.message_id, substr(json_extract(p.data, '$.text'), 1, 500) as text_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant' AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created, p.time_created
    LIMIT 15
""", (LOGIN_SESSION,))
for row in c.fetchall():
    if row['text_preview']:
        print(f"  [{row['message_id']}] {row['text_preview'][:200]}")
        print()

# Check for tool calls that wrote files
print(f"\n=== TOOL PARTS (write/edit) IN LOGIN SESSION ===")
c.execute("""
    SELECT p.id, p.message_id, json_extract(p.data, '$.tool') as tool,
           substr(json_extract(p.data, '$.state.input.file_path'), 1, 200) as file_path,
           substr(json_extract(p.data, '$.state.input.new_string'), 1, 200) as new_string_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') IN ('write', 'edit')
    ORDER BY m.time_created, p.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['tool']}: {row['file_path']}")
    if row['new_string_preview']:
        print(f"    new_string: {row['new_string_preview'][:150]}")
    print()

# Check task events
print(f"\n=== TASK EVENTS IN LOGIN SESSION ===")
c.execute("SELECT * FROM task WHERE session_id = ?", (LOGIN_SESSION,))
tasks = c.fetchall()
for t in tasks:
    print(f"  Task: {dict(t)}")

c.execute("SELECT * FROM task_event WHERE session_id = ? ORDER BY time_created", (LOGIN_SESSION,))
events = c.fetchall()
for e in events:
    print(f"  Event: {dict(e)}")

# Check actor_registry for subagents
print(f"\n=== ACTOR REGISTRY ===")
c.execute("SELECT * FROM actor_registry WHERE session_id = ? ORDER BY time_created", (LOGIN_SESSION,))
actors = c.fetchall()
for a in actors:
    print(f"  Actor: {dict(a)}")

# Also check lost context session
c.execute("SELECT * FROM task WHERE session_id = ?", (LOST_SESSION,))
tasks2 = c.fetchall()
for t in tasks2:
    print(f"  Task (lost): {dict(t)}")

c.execute("SELECT * FROM task_event WHERE session_id = ? ORDER BY time_created", (LOST_SESSION,))
events2 = c.fetchall()
for e in events2:
    print(f"  Event (lost): {dict(e)}")

conn.close()
