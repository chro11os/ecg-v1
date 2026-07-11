import json
from fastapi import APIRouter, HTTPException
from backend.app.database import get_db_connection

router = APIRouter(prefix="/scans", tags=["scans"])

@router.get("")
async def list_recent_scans(limit: int = 50):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Join with patients to get patient name
        cursor.execute("""
            SELECT s.*, p.name as patient_name 
            FROM scans s
            LEFT JOIN patients p ON s.patient_id = p.id
            ORDER BY s.timestamp DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        scans = []
        for r in rows:
            scan = dict(r)
            scan["signal_data"] = json.loads(scan["signal_data"]) if scan["signal_data"] else []
            scan["r_peaks"] = json.loads(scan["r_peaks"]) if scan["r_peaks"] else []
            scan["grad_cam"] = json.loads(scan["grad_cam"]) if scan["grad_cam"] else []
            scans.append(scan)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return scans

@router.delete("/{scan_id}")
async def delete_scan(scan_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM scans WHERE id = ?", (scan_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Scan record not found")
            
        cursor.execute("DELETE FROM scans WHERE id = ?", (scan_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return {"status": "success", "message": f"Scan record {scan_id} deleted."}

@router.put("/{scan_id}")
async def update_scan(scan_id: int, payload: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM scans WHERE id = ?", (scan_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Scan record not found")
            
        if "predicted_class" in payload:
            cursor.execute("UPDATE scans SET predicted_class = ? WHERE id = ?", (payload["predicted_class"], scan_id))
            conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return {"status": "success", "message": f"Scan record {scan_id} updated."}

@router.get("/{scan_id}")
async def get_scan(scan_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM scans WHERE id = ?", (scan_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Scan record not found")
        
        scan = dict(row)
        scan["signal_data"] = json.loads(scan["signal_data"]) if scan["signal_data"] else []
        scan["r_peaks"] = json.loads(scan["r_peaks"]) if scan["r_peaks"] else []
        scan["grad_cam"] = json.loads(scan["grad_cam"]) if scan["grad_cam"] else []
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return scan
