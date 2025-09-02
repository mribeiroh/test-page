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
    // 1. Get run metadata from GitHub
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

    // 2. Try to fetch logs and extract Cypress Cloud URL
    let cypressUrl = null;
    try {
      const logsRes = await fetch(
        `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs/${id}/logs`,
        {
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json"
          }
        }
      );

      if (logsRes.ok) {
        const logsText = await logsRes.text();
        const regex = /(https:\/\/cloud\.cypress\.io\/projects\/[a-z0-9]+\/runs\/\d+)/;
        const match = regex.exec(logsText);
        if (match) {
          cypressUrl = match[1];
        }
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch logs for run ${id}:`, err.message);
    }

    // 3. Return merged data
    return res.status(200).json({
      id: ghData.id,
      name: ghData.name,
      status: ghData.status,                   // queued, in_progress, completed
      conclusion: ghData.conclusion || "pending",
      url: ghData.html_url,                    // GitHub run
      cypressUrl,                              // Cypress Cloud link (from logs)
      env: ghData.name?.toLowerCase().includes("qa") ? "qa" : "dev",
      message: ghData.head_commit?.message || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
