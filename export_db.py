import psycopg2
import json

conn = psycopg2.connect(host='localhost', port=5432, database='kaoshiku', user='postgres', password='password')
cur = conn.cursor()

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
print("=== 数据库表 ===")
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    count = cur.fetchone()[0]
    print(f"  {t}: {count} 条")

for t in tables:
    print(f"\n{'='*60}")
    print(f"=== {t} ===")
    cur.execute(f"SELECT * FROM {t} ORDER BY id LIMIT 50")
    cols = [desc[0] for desc in cur.description]
    rows = cur.fetchall()
    for row in rows:
        d = {}
        for i, col in enumerate(cols):
            val = row[i]
            if isinstance(val, (dict, list)):
                val = json.dumps(val, ensure_ascii=False)
            elif hasattr(val, 'isoformat'):
                val = val.isoformat()
            d[col] = val
        print(f"  {json.dumps(d, ensure_ascii=False, default=str)}")

conn.close()
