import random
import string
import json
from fastapi import APIRouter, HTTPException
from backend.app.database import get_db_connection
from backend.app.models.schemas import PatientCreate

router = APIRouter(prefix="/patients", tags=["patients"])

# Unique patient ID generator format: #XXXX-X
def generate_unique_patient_id(conn) -> str:
    cursor = conn.cursor()
    while True:
        num = random.randint(1000, 9999)
        let = random.choice(string.ascii_uppercase)
        candidate = f"#{num}-{let}"
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (candidate,))
        if not cursor.fetchone():
            return candidate

# CHA₂DS₂-VASc rule engine
def compute_cha2ds2_vasc(age: int, gender: str, hypertension: int, diabetes: int, stroke_history: int, vascular_disease: int, heart_failure: int) -> int:
    score = 0
    if heart_failure:
        score += 1
    if hypertension:
        score += 1
    if age >= 75:
        score += 2
    elif 65 <= age <= 74:
        score += 1
    if diabetes:
        score += 1
    if stroke_history:
        score += 2
    if vascular_disease:
        score += 1
    if gender.lower() in ("f", "female"):
        score += 1
    return score

@router.post("")
async def create_patient(patient: PatientCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        patient_id = patient.id
        if not patient_id:
            patient_id = generate_unique_patient_id(conn)
            
        cursor.execute("""
            INSERT OR REPLACE INTO patients (id, name, age, gender, hypertension, diabetes, stroke_history, vascular_disease, heart_failure)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            patient_id, patient.name, patient.age, patient.gender,
            patient.hypertension, patient.diabetes, patient.stroke_history,
            patient.vascular_disease, patient.heart_failure
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {"status": "success", "message": f"Patient {patient_id} registered/updated successfully.", "patient_id": patient_id}

@router.get("/next-id")
async def get_next_id():
    conn = get_db_connection()
    try:
        next_id = generate_unique_patient_id(conn)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {"next_id": next_id}

@router.get("")
async def list_patients():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM patients")
        rows = cursor.fetchall()
        patients_list = []
        for row in rows:
            p = dict(row)
            p["stroke_risk_score"] = compute_cha2ds2_vasc(
                p["age"], p["gender"], p["hypertension"], p["diabetes"],
                p["stroke_history"], p["vascular_disease"], p["heart_failure"]
            )
            
            cursor.execute("SELECT predicted_class FROM scans WHERE patient_id = ?", (p["id"],))
            scans = cursor.fetchall()
            total_scans = len(scans)
            if total_scans > 0:
                afib_scans = sum(1 for s in scans if s["predicted_class"] > 0)
                p["cumulative_burden"] = round((afib_scans / total_scans) * 100.0, 2)
            else:
                p["cumulative_burden"] = 0.0
                
            patients_list.append(p)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return patients_list

@router.get("/{patient_id}/history")
async def get_patient_history(patient_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Patient not found")
            
        cursor.execute("SELECT * FROM scans WHERE patient_id = ? ORDER BY timestamp DESC", (patient_id,))
        rows = cursor.fetchall()
        history = []
        for row in rows:
            scan = dict(row)
            if scan["signal_data"]:
                scan["signal_data"] = json.loads(scan["signal_data"])
            if scan["r_peaks"]:
                scan["r_peaks"] = json.loads(scan["r_peaks"])
            if scan["grad_cam"]:
                scan["grad_cam"] = json.loads(scan["grad_cam"])
            history.append(scan)
    except HTTPException:
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return history

@router.delete("/{patient_id}")
async def delete_patient(patient_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Patient not found")
        
        cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return {"status": "success", "message": f"Patient {patient_id} deleted."}

@router.put("/{patient_id}")
async def update_patient(patient_id: str, patient: PatientCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM patients WHERE id = ?", (patient_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Patient not found")
            
        cursor.execute("""
            UPDATE patients 
            SET name = ?, age = ?, gender = ?, hypertension = ?, diabetes = ?, 
                stroke_history = ?, vascular_disease = ?, heart_failure = ?
            WHERE id = ?
        """, (
            patient.name, patient.age, patient.gender,
            patient.hypertension, patient.diabetes, patient.stroke_history,
            patient.vascular_disease, patient.heart_failure, patient_id
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return {"status": "success", "message": f"Patient {patient_id} updated."}
