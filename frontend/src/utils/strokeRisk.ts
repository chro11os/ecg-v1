// CHA2DS2-VASc stroke risk: category, recommendation and per-criterion breakdown

export const getStrokeRiskCategory = (score: number) => {
	if (score === 0) return { label: "Low risk", rec: "No anticoagulation therapy indicated." };
	if (score === 1) return { label: "Moderate risk", rec: "Oral anticoagulation should be considered based on clinical judgment." };
	return { label: "High risk", rec: "Oral anticoagulation therapy is strongly recommended." };
};

export const getCHA2DS2VAScBreakdown = (patient: any) => {
	const breakdown: { criteria: string; pts: number; active: boolean }[] = [];
	
	// CHF
	breakdown.push({
		criteria: "Congestive heart failure",
		pts: 1,
		active: patient.heart_failure === 1
	});
	
	// Hypertension
	breakdown.push({
		criteria: "Hypertension",
		pts: 1,
		active: patient.hypertension === 1
	});
	
	// Age >= 75 (2 pts) or 65-74 (1 pt)
	breakdown.push({
		criteria: "Age 75 or older",
		pts: 2,
		active: patient.age >= 75
	});
	breakdown.push({
		criteria: "Age 65–74",
		pts: 1,
		active: patient.age >= 65 && patient.age < 75
	});
	
	// Diabetes
	breakdown.push({
		criteria: "Diabetes",
		pts: 1,
		active: patient.diabetes === 1
	});
	
	// Stroke
	breakdown.push({
		criteria: "Stroke or TIA",
		pts: 2,
		active: patient.stroke_history === 1
	});
	
	// Vascular Disease
	breakdown.push({
		criteria: "Vascular disease",
		pts: 1,
		active: patient.vascular_disease === 1
	});
	
	// Gender
	breakdown.push({
		criteria: "Female sex",
		pts: 1,
		active: patient.gender.toLowerCase() === "female" || patient.gender.toLowerCase() === "f"
	});
	
	return breakdown;
};
