from pydantic import BaseModel
from typing import List, Optional

class PatientCreate(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    gender: str
    hypertension: int = 0
    diabetes: int = 0
    stroke_history: int = 0
    vascular_disease: int = 0
    heart_failure: int = 0

class ECGPayload(BaseModel):
    signal: List[float]
    patient_id: Optional[str] = None
