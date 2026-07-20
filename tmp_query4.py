import sqlite3, json

DB_PATH = r"C:\Users\ByulyantHasanovHCM-M\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

LOGIN_SESSION = "ses_09b912051ffehq4ARyAj25Y0ty"

# Get user messages with actual text content (not just diffs)
print("=== USER MESSAGES WITH TEXT (LOGIN SESSION) ===")
c.execute("""
    SELECT m.id, json_extract(m.data, '$.role') as role, m.time_created,
           json_extract(m.data, '$.summary') as summary_data
    FROM message m
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    summary = row['summary_data']
    if summary:
        try:
            s = json.loads(summary) if isinstance(summary, str) else summary
            if isinstance(s, dict) and s.get('diffs'):
                # Has diffs - show the file
                for d in s['diffs']:
                    print(f"  [{row['id']}] User sent file change: {d.get('file', 'N/A')}")
            elif isinstance(s, dict):
                print(f"  [{row['id']}] User message: {json.dumps(s)[:200]}")
        except:
            print(f"  [{row['id']}] {str(summary)[:200]}")

# Check user messages for text content in the message parts
print("\n=== USER MESSAGE PARTS (LOGIN SESSION) ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.type') as part_type,
           substr(json_extract(p.data, '$.text'), 1, 500) as text_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    if row['text_preview']:
        print(f"  [{row['message_id']}] {row['part_type']}: {row['text_preview'][:300]}")
        print()

# Look at the full text of key assistant messages about Supabase URL issue
print("\n=== KEY ASSISTANT MESSAGE (Supabase URL issue) ===")
c.execute("""
    SELECT p.message_id, substr(json_extract(p.data, '$.text'), 1, 1500) as text_preview
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'text'
      AND json_extract(p.data, '$.text') LIKE '%rest/v1%'
    ORDER BY m.time_created
    LIMIT 5
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['text_preview']}")
    print()

# Check what the debug route was created for
print("\n=== DEBUG ROUTE CREATION ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.state.input.content') as content
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') = 'write'
      AND json_extract(p.data, '$.state.input.file_path') LIKE '%debug%'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['content'][:500]}")

# Get the middleware content
print("\n=== MIDDLEWARE CONTENT ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.state.input.content') as content
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') = 'write'
      AND json_extract(p.data, '$.state.input.file_path') LIKE '%middleware%'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['content'][:800]}")

# Get auth callback content
print("\n=== AUTH CALLBACK CONTENT ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.state.input.content') as content
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') = 'write'
      AND json_extract(p.data, '$.state.input.file_path') LIKE '%callback%'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['content'][:800]}")

# Check signup page content
print("\n=== SIGNUP PAGE CONTENT ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.state.input.content') as content
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = ? AND json_extract(p.data, '$.tool') = 'write'
      AND json_extract(p.data, '$.state.input.file_path') LIKE '%signup%'
    ORDER BY m.time_created
""", (LOGIN_SESSION,))
for row in c.fetchall():
    print(f"  [{row['message_id']}] {row['content'][:800]}")

# Also check the lost context session for edits
print("\n=== LOST CONTEXT SESSION EDITS ===")
c.execute("""
    SELECT p.message_id, json_extract(p.data, '$.tool') as tool,
           json_extract(p.data, '$.state.input') as input_data
    FROM part p
    JOIN message m ON m.id = p.message_id
    WHERE m.session_id = 'ses_09aeff9e8ffeXpZf9Jn9ppE4NK'
      AND json_extract(p.data, '$.tool') IN ('write', 'edit')
    ORDER BY m.time_created
""", ())
for row in c.fetchall():
    inp = json.loads(row['input_data']) if row['input_data'] else {}
    fp = inp.get('file_path', 'N/A')
    ns = inp.get('new_string', inp.get('content', ''))[:200]
    print(f"  [{row['message_id']}] {row['tool']}: {fp}")
    if ns:
        print(f"    new_string: {ns}")
    print()

conn.close()
