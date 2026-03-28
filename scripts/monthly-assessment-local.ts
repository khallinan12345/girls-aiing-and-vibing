import "dotenv/config";
import { runMonthlyAssessments } from "../supabase/functions/_shared/monthlyAssessment";

async function main() {
  const result = await runMonthlyAssessments();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});