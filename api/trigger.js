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

  const { message = "Triggered from GitHub Pages", env = "dev" } = req.body || {};

  // 👇 map env selection to correct workflow file
  const workflowFile = env === "qa" ? "qa.yml" : "dev.yml";

  try {
    // 1. Trigger correct workflow
    const dispatch = await fetch(
      `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { message }
        })
      }
    );

    if (!dispatch.ok) {
      const err = await dispatch.text();
      return res.status(dispatch.status).json({ error: err });
    }

    // 2. Wait for GitHub to register the run
    await new Promise(r => setTimeout(r, 3000));

    // 3. Get recent runs (optional: filter by workflowFile)
    const runs = await fetch(
      "https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs?branch=main&per_page=3",
      {
        headers: {
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json"
        }
      }
    );

    const data = await runs.json();
    if (!runs.ok || !Array.isArray(data.workflow_runs)) {
      return res.status(runs.status).json({ error: data });
    }

    const run = data.workflow_runs.find(r => r.name.toLowerCase().includes(env)) || data.workflow_runs[0];

    return res.status(200).json({
      success: true,
      id: run?.id,
      name: run?.name,
      status: run?.status || "unknown",
      conclusion: run?.conclusion || "pending",
      url: run?.html_url,
      message,
      env
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
