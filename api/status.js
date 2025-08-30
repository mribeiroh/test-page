export default async function handler(req, res) {
  const allowedOrigins = [
    "https://mribeiroh.github.io", // GitHub Pages
    "http://localhost:3000"        // local dev
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const ghRes = await fetch(
      "https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs?branch=main&per_page=1",
      {
        headers: {
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json"
        }
      }
    );

    const data = await ghRes.json();

    if (!ghRes.ok || !Array.isArray(data.workflow_runs)) {
      return res.status(ghRes.status).json({ error: data });
    }

    const run = data.workflow_runs[0];
    if (!run) {
      return res.status(404).json({ error: "No workflow runs found" });
    }

    return res.status(200).json({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      // try to infer env from workflow name
      env: run.name?.toLowerCase().includes("qa") ? "qa" : "dev"
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
