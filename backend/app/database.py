import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ecg_records.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create patients table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            hypertension INTEGER DEFAULT 0,
            diabetes INTEGER DEFAULT 0,
            obesity INTEGER DEFAULT 0,
            stroke_history INTEGER DEFAULT 0,
            vascular_disease INTEGER DEFAULT 0,
            heart_failure INTEGER DEFAULT 0
        )
    """)
    
    # Run migration to add obesity to existing DB tables
    try:
        cursor.execute("ALTER TABLE patients ADD COLUMN obesity INTEGER DEFAULT 0;")
    except sqlite3.OperationalError:
        pass  # Column already exists
    
    # Create monitoring_sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS monitoring_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            type TEXT NOT NULL, -- 'real_online' or 'synthetic_simulation'
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            end_time DATETIME,
            classification TEXT, -- 'Paroxysmal', 'Persistent', 'Long-standing Persistent', 'Sinus Rhythm'
            total_duration_hours REAL,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
    """)
    
    # Create scans table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            signal_data TEXT, -- Stored as JSON string
            predicted_class INTEGER NOT NULL,
            confidence REAL NOT NULL,
            rr_variance REAL DEFAULT 0.0,
            rmssd REAL DEFAULT 0.0,
            r_peaks TEXT,     -- Stored as JSON string
            grad_cam TEXT,    -- Stored as JSON string
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
    """)

    # Create patient_pictures table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patient_pictures (
            patient_id TEXT PRIMARY KEY,
            picture_url TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")

