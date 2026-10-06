// src/types.ts
export type BurdenTier = 0 | 1 | 2 | 3; // 0 = Sinus Rhythm, 1 = Micro-Burden, 2 = Intermediate, 3 = High

export interface Patient {
    id: string;
    name: string;
    age: number;
    gender: string;
    hypertension: number;
    diabetes: number;
    stroke_history: number;
    vascular_disease: number;
    heart_failure: number;
    stroke_risk_score?: number;
    cumulative_burden?: number;
    picture_url?: string;
}

export interface DiagnosisData {
    id?: number;
    burdenTier: BurdenTier;
    confidence: number;
    burden: number | null; // % of 2 s windows in AFib; null for scans made before burden was measured
    hardware: string;
    responseTime: number;
    rawSignal: number[];
    rPeaks?: number[];
    rrVariance?: number;
    rmssd?: number;
    gradCam?: number[];
    windowProbs?: number[];         // P(AFib) per 2 s window
    strokeRiskScore?: number;       // CHA2DS2-VASc score
    cumulativeAFibBurden?: number;  // Aggregated percentage
    patientId?: string;
}