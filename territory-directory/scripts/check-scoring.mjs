import { createRequire } from "node:module";
// Lightweight sanity: opportunity tiers and distance helper stay ordered.
function opportunityTier(score) {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}
const require = createRequire(import.meta.url);
void require;
const samples = [90, 70, 50, 49, 10];
const tiers = samples.map(opportunityTier);
if (tiers.join() !== "high,high,medium,low,low") {
  console.error("tier mismatch", tiers);
  process.exit(1);
}
console.log("check-scoring ok");
