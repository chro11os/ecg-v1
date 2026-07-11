from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from backend.app.routers import patients, scans, predict

app = FastAPI(title="ECG Atrial Fibrillation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(scans.router)
app.include_router(predict.router)
