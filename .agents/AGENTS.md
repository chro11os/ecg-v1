# Workspace Rules & Memories

## Clinically Reframed Terminology & States
* Terminology was refactored from "Severity Levels" (`Normal, Trace, Mild, Severe`) to **AFib Burden Tiers** (`Sinus Rhythm`, `Micro-Burden / Rare Paroxysm`, `Intermediate Burden / Active Paroxysm`, `High Burden / Persistent AFib`).
* The model classifies each 2-second window as AFib / non-AFib; a scan's burden is the share of AFib windows (`afib_burden`, stored per scan) and the tier is derived from it (`model.burden_tier`).
* Patients track longitudinal **Cumulative Burden** (percentage of total historical scans showing active AFib).

## Database Schema & Migrations
* Database: SQLite (`ecg_records.db`).
* `patients` table stores demographic inputs and comorbidity flags.
* `scans` table stores prediction metadata: `signal_data` (JSON array), `predicted_class`, `confidence`, `afib_burden`, `rr_variance`, `rmssd`, `r_peaks` (JSON array of peak locations), `grad_cam` (JSON array), and `timestamp`.
* IDs are generated as unique clinical candidates (format `#XXXX-X`) on the backend (`GET /patients/next-id` endpoint) and previewed in the UI.

## Workstation Split-Pane Navigation
* Registry sidebar handles patient switching, registration, and scan logs listings.
* Selecting a patient targets them. When targeted and no scan is open, the main workstation displays a file upload dropzone to run scans for that targeted profile.
* Clicking another patient closes the active ECG diagnostic dashboard (sets `diagnosis` to `null`) and shifts context.
* Diagnostic Dashboard is full-width, responsive, and contains a CHA₂DS₂-VASc card with comorbidity checklists, a longitudinal line chart trend, and an explainable Grad-CAM Waveform chart.
