import sqlite3, pathlib
db=pathlib.Path('db.sqlite3')
print('db exists:', db.exists(), db.resolve())
if db.exists():
    conn=sqlite3.connect(str(db))
    cur=conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    rows = cur.fetchall()
    for r in rows:
        print(r[0])
    conn.close()
