export default async function handler(req, res) {
  const allowedOrigins = [
    "https://mribeiroh.github.io",
    "http://localhost:3000"
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { env = "dev" } = req.body || {};
  const workflowFile = env === "qa" ? "qa.yml" : "dev.yml";

  try {
    // 1. Trigger workflow_dispatch
    const dispatch = await fetch(
      `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (!dispatch.ok) {
      const err = await dispatch.text();
      return res.status(dispatch.status).json({ error: err });
    }

    // 2. Wait for GitHub to register run
    await new Promise(r => setTimeout(r, 3000));

    // 3. Get the latest workflow_dispatch runs only
    const runsRes = await fetch(
      "https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs?branch=main&event=workflow_dispatch&per_page=10",
      {
        headers: {
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json"
        }
      }
    );

    const data = await runsRes.json();
    if (!runsRes.ok || !Array.isArray(data.workflow_runs)) {
      return res.status(runsRes.status).json({ error: data });
    }

    // ✅ Always pick the most recent *workflow_dispatch* run that matches the env workflow
    const run = data.workflow_runs.find(r =>
      r.name?.toLowerCase().includes(env)
    );

    if (!run) {
      return res.status(404).json({ error: `No ${env} run found` });
    }

    const sha = run.head_sha;

    // 4. Try to fetch Cypress Cloud run by commit SHA
    let cypressUrl = null;
    if (sha) {
      try {
        const ccRes = await fetch(
          `https://api.cypress.io/projects/${process.env.CYPRESS_PROJECT_ID}/runs?limit=10`,
          {
            headers: {
              "Authorization": `Bearer ${process.env.CYPRESS_RECORD_KEY}`,
              "Accept": "application/json"
            }
          }
        );
        if (ccRes.ok) {
          const ccData = await ccRes.json();
          const cloudRun = ccData.runs?.find(r => r.commit?.sha === sha);
          if (cloudRun) {
            cypressUrl = cloudRun.url;
          }
        }
      } catch (err) {
        console.warn("⚠️ Failed to fetch Cypress Cloud run:", err.message);
      }
    }

    // 5. Return exact run details
    return res.status(200).json({
      success: true,
      id: run.id,
      name: run.name,
      status: run.status || "unknown",
      conclusion: run.conclusion || "pending",
      url: run.html_url,
      cypressUrl,
      env
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
