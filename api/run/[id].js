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

  const { id } = req.query;

  try {
    // 1. GitHub run by ID
    const ghRes = await fetch(
      `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs/${id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(ghRes.status).json({ error: err });
    }
    const ghData = await ghRes.json();

    // 2. Cypress Cloud runs by commit SHA
    const sha = ghData.head_sha;
    const ccRes = await fetch(
      `https://api.cypress.io/projects/${process.env.CYPRESS_PROJECT_ID}/runs?limit=10`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CYPRESS_RECORD_KEY}`,
          Accept: "application/json"
        }
      }
    );

    const ccData = ccRes.ok ? await ccRes.json() : { runs: [] };
    const cloudRun = ccData.runs?.find(r => r.commit?.sha === sha);

    // 3. Response with merged data
    return res.status(200).json({
      id: ghData.id,
      name: ghData.name,
      status: ghData.status,
      conclusion: ghData.conclusion,
      url: ghData.html_url,             // GitHub link
      cypressUrl: cloudRun?.url || null, // Cypress Cloud link
      env: ghData.head_commit?.message?.toLowerCase().includes("qa") ? "qa" : "dev",
      message: ghData.head_commit?.message || null
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
