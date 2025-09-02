export default async function handler(req, res) {
  const allowedOrigins = [
    "https://mribeiroh.github.io",
    "http://localhost:3000"
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
    // 1. Fetch GitHub runs
    const ghRes = await fetch(
      "https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs?branch=main&per_page=10",
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

    // 2. Fetch Cypress Cloud runs
    const ccRes = await fetch(
      `https://api.cypress.io/projects/${process.env.CYPRESS_PROJECT_ID}/runs?limit=20`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.CYPRESS_RECORD_KEY}`,
          "Accept": "application/json"
        }
      }
    );

    const ccData = ccRes.ok ? await ccRes.json() : { runs: [] };

    // 3. Merge GitHub + Cypress runs by commit SHA
    const runs = data.workflow_runs.map(run => {
      const sha = run.head_sha;
      const cloudRun = ccData.runs?.find(r => r.commit?.sha === sha);

      return {
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,               // GitHub Actions link
        cypressUrl: cloudRun?.url || null, // Cypress Cloud link (if matched)
        env: run.name?.toLowerCase().includes("qa") ? "qa" : "dev"
      };
    });

    return res.status(200).json({ success: true, runs });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
