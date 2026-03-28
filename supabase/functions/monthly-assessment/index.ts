import { runMonthlyAssessments } from "../_shared/monthlyAssessment.ts";

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${Deno.env.get("CRON_SECRET")}`;

    if (authHeader !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await runMonthlyAssessments();

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});