/**
 * Generates simulated ECG signal data.
 * @param type "normal" (Sinus Rhythm) or "afib" (Atrial Fibrillation)
 * @param numSamples Number of samples to generate (typically 2500 for 10 seconds @ 250Hz)
 * @returns Array of ECG voltages and the indices of R-peaks
 */
export function generateECGData(type: "normal" | "afib", numSamples: number = 2500): { signal: number[]; rPeaks: number[] } {
    const data: number[] = new Array(numSamples).fill(0);
    const fs = 250; // 250 Hz
    
    // Determine beat locations (R-peak indices)
    const rPeaks: number[] = [];
    let currentIdx = type === "normal" ? 100 : 50; // start index offset
    
    while (currentIdx < numSamples - 150) {
        rPeaks.push(currentIdx);
        
        // Sinus rhythm: regular intervals (e.g. 185 to 215 samples)
        // AFib: irregular tachycardic intervals (e.g. 50 to 130 samples, 115-300 BPM)
        const interval = type === "normal"
            ? 200 + Math.round(Math.random() * 24 - 12) // 188-212 (approx 75 BPM)
            : 50 + Math.round(Math.random() * 80);      // 50-130 (irregular, fast)
        currentIdx += interval;
    }
    
    // Synthesize baseline signal
    for (let i = 0; i < numSamples; i++) {
        // Add baseline wander (respiratory drift, 0.1Hz - 0.4Hz)
        let val = 0.08 * Math.sin(2 * Math.PI * 0.12 * (i / fs)) +
                  0.03 * Math.sin(2 * Math.PI * 0.35 * (i / fs));
                  
        // Add random high-frequency muscle noise
        val += (Math.random() - 0.5) * 0.02;
        
        // Add chaotic f-waves for AFib baseline (fibrillation)
        if (type === "afib") {
            // AFib has rapid chaotic f-waves (4-8 Hz)
            val += 0.06 * Math.sin(2 * Math.PI * 5.8 * (i / fs)) +
                   0.03 * Math.sin(2 * Math.PI * 9.2 * (i / fs)) +
                   0.02 * Math.sin(2 * Math.PI * 14.1 * (i / fs));
            val += (Math.random() - 0.5) * 0.015;
        }
        
        data[i] = val;
    }
    
    // Add heartbeat complexes at each R-peak location
    rPeaks.forEach((rPeakIdx) => {
        // 1. P-wave (only for normal sinus rhythm)
        if (type === "normal") {
            const pOffset = -42; // ~170ms before R-peak
            const pWidth = 10;
            const pAmp = 0.07;
            for (let d = -20; d <= 20; d++) {
                const idx = rPeakIdx + pOffset + d;
                if (idx >= 0 && idx < numSamples) {
                    data[idx] += pAmp * Math.exp(-Math.pow(d / pWidth, 2));
                }
            }
        }
        
        // 2. QRS Complex
        // Q-peak: sharp negative spike
        const qOffset = -5;
        const qAmp = -0.12;
        const qWidth = 2.5;
        for (let d = -5; d <= 5; d++) {
            const idx = rPeakIdx + qOffset + d;
            if (idx >= 0 && idx < numSamples) {
                data[idx] += qAmp * Math.exp(-Math.pow(d / qWidth, 2));
            }
        }
        
        // R-peak: sharp tall positive spike
        const rAmp = 0.85 + (Math.random() * 0.08 - 0.04);
        const rWidth = 2.0;
        for (let d = -6; d <= 6; d++) {
            const idx = rPeakIdx + d;
            if (idx >= 0 && idx < numSamples) {
                data[idx] += rAmp * Math.exp(-Math.pow(d / rWidth, 2));
            }
        }
        
        // S-peak: sharp negative spike
        const sOffset = 5;
        const sAmp = -0.22;
        const sWidth = 2.5;
        for (let d = -5; d <= 5; d++) {
            const idx = rPeakIdx + sOffset + d;
            if (idx >= 0 && idx < numSamples) {
                data[idx] += sAmp * Math.exp(-Math.pow(d / sWidth, 2));
            }
        }
        
        // 3. T-wave: smooth positive wide wave (flat/absent in rapid AFib)
        const tOffset = 48; // ~190ms after R-peak
        const tAmp = type === "normal"
            ? 0.16 + (Math.random() * 0.03 - 0.015)
            : 0.02 + (Math.random() * 0.01 - 0.005);
        const tWidth = 20;
        for (let d = -40; d <= 40; d++) {
            const idx = rPeakIdx + tOffset + d;
            if (idx >= 0 && idx < numSamples) {
                data[idx] += tAmp * Math.exp(-Math.pow(d / tWidth, 2));
            }
        }
    });
    
    return { signal: data, rPeaks };
}
