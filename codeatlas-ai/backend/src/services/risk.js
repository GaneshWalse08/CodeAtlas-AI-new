// Simple, explainable risk scoring per spec section 5:
// normalize change-frequency 0-1, subtract if tests exist, bucket into low/med/high.

export function computeRiskBucket(changeCount, hasTests, maxChangeCountInRepo) {
  const denom = Math.max(maxChangeCountInRepo, 1);
  let score = changeCount / denom; // 0..1
  if (hasTests) score -= 0.25;
  score = Math.max(0, Math.min(1, score));

  let bucket;
  if (score < 0.33) bucket = "low";
  else if (score < 0.66) bucket = "medium";
  else bucket = "high";

  return { score, bucket };
}
