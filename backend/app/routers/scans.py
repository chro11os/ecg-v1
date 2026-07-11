import json
from fastapi import APIRouter, HTTPException
from backend.app.database import get_db_connection

router = APIRouter(prefix="/scans", tags=["scans"])

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
