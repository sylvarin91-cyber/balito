import sqlite3, json

DB_PATH = r"C:\Users\ByulyantHasanovHCM-M\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

LOGIN_SESSION = "ses_09b912051ffehq4ARyAj25Y0ty"
LOST_SESSION = "ses_09aeff9e8ffeXpZf9Jn9ppE4NK"

# Check task_event schema
print("=== TASK_EVENT SCHEMA ===")
c.execute("PRAGMA table_info(task_event)")
for row in c.fetchall():
    print(f"  {row['name']} ({row['type']})")

print("\n=== TASK EVENTS ===")
c.execute("SELECT * FROM task_event WHERE session_id = ? ORDER BY rowid", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  {dict(row)}")

# Get text parts from "Lost context" session - user messages with content
print(f"\n=== USER TEXT IN LOST CONTEXT SESSION ===")
c.execute("""
    SELECT m.id, substr(json_extract(m.data, '$.summary'), 1, 800) as summary
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
""", (LOST_SESSION,))
for row in c.fetchall():
    if row['summary']:
        print(f"  [{row['id']}] {row['summary'][:400]}")
        print()

# Get assistant text from "Lost context" session
print(f"\n=== ASSISTANT TEXT IN LOST CONTEXT SESSION ===")
c.execute("""
    SELECT p.id, p.message_id, substr(json_extract(p.data, '$.text'), 1, 500) as text_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant' AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created, p.time_created
""", (LOST_SESSION,))
for row in c.fetchall():
    if row['text_preview']:
        print(f"  [{row['message_id']}] {row['text_preview'][:300]}")
        print()

# Tool parts from Lost context session
print(f"\n=== TOOL PARTS IN LOST CONTEXT SESSION ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.tool') as tool,
           substr(json_extract(p.data, '$.state.input.file_path'), 1, 200) as file_path
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') IN ('write', 'edit')
    ORDER BY m.time_created, p.time_created
""", (LOST_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['tool']}: {row['file_path']}")

# Get remaining text from login session (later messages)
print(f"\n=== LATER TEXT IN LOGIN SESSION ===")
c.execute("""
    SELECT p.id, p.message_id, substr(json_extract(p.data, '$.text'), 1, 500) as text_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant' AND json_extract(p.data, '$.type') = 'text'
    ORDER BY m.time_created, p.time_created
    LIMIT 50
""", (LOGIN_SESSION,))
for row in c.fetchall():
    if row['text_preview']:
        print(f"  [{row['message_id']}] {row['text_preview'][:250]}")
        print()

# Check what user said in login session (last few messages)
print(f"\n=== USER MESSAGES IN LOGIN SESSION (last 10) ===")
c.execute("""
    SELECT m.id, substr(json_extract(m.data, '$.summary'), 1, 800) as summary
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created DESC
    LIMIT 10
""", (LOGIN_SESSION,))
for row in c.fetchall():
    if row['summary']:
        print(f"  [{row['id']}] {row['summary'][:400]}")
        print()

# Get the files that were written in the login session
print(f"\n=== ALL WRITE/EDIT TOOL INPUTS (LOGIN SESSION) ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.tool') as tool,
           json_extract(p.data, '$.state.input') as input_data
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') IN ('write', 'edit')
    ORDER BY m.time_created, p.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    inp = json.loads(row['input_data']) if row['input_data'] else {}
    fp = inp.get('file_path', 'N/A')
    content_preview = inp.get('content', inp.get('new_string', ''))[:150] if inp else ''
    print(f"  [{row['message_id']}] {row['tool']}: {fp}")
    if content_preview:
        print(f"    content: {content_preview}")
    print()

# Check files in the current project
print(f"\n=== PROJECT FILES ===")
import os
for root, dirs, files in os.walk(r"C:\New\balito\src"):
    dirs[:] = [d for d in dirs if d != 'node_modules' and d != '.next']
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), r"C:\New\balito")
        print(f"  {rel}")

conn.close()
