import sqlite3
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.app.database import init_db, DB_PATH

def seed():
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    patients = [
        ("#8492-A", "Arthur Pendelton", 62, "male", 1, 0, 0, 0, 1),
        ("#1039-B", "Eleanor Vance", 45, "female", 0, 1, 0, 0, 0),
        ("#4812-C", "David Vance", 71, "male", 1, 0, 1, 1, 0)
    ]
    
    for p in patients:
        cursor.execute("""
            INSERT OR REPLACE INTO patients (id, name, age, gender, hypertension, diabetes, stroke_history, vascular_disease, heart_failure)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, p)
        
    conn.commit()
    conn.close()
    print("Database seeded successfully with default patient profiles.")

if __name__ == "__main__":
    seed()
