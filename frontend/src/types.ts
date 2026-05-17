// src/types.ts
export type SeverityLevel = 0 | 1 | 2 | 3;

export interface DiagnosisData {
    severity: SeverityLevel;
    confidence: number;
    burden: number;
    hardware: string;
    responseTime: number;
}