import JSZip from "jszip";

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
    const sha = ghData.head_sha;
    let cypressUrl = null;

    // 2a. Try Cypress Cloud API lookup by commit SHA
    if (sha) {
      try {
        const ccRes = await fetch(
          `https://api.cypress.io/projects/${process.env.CYPRESS_PROJECT_ID}/runs?limit=20`,
          {
            headers: {
              Authorization: `Bearer ${process.env.CYPRESS_RECORD_KEY}`,
              Accept: "application/json"
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
        console.warn(`⚠️ Failed Cypress API lookup for run ${id}:`, err.message);
      }
    }

    // 2b. Fallback: scrape logs if Cypress API didn’t match
    if (!cypressUrl) {
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
          const buffer = await logsRes.arrayBuffer();
          const zip = await JSZip.loadAsync(buffer);

          for (const fileName of Object.keys(zip.files)) {
            const file = zip.files[fileName];
            if (!file.dir) {
              const content = await file.async("string");
              const regex = /(https:\/\/cloud\.cypress\.io\/projects\/[a-z0-9]+\/runs\/\d+)/;
              const match = regex.exec(content);
              if (match) {
                cypressUrl = match[1];
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Failed to parse logs for run ${id}:`, err.message);
      }
    }

    // 3. Return merged data
    return res.status(200).json({
      id: ghData.id,
      name: ghData.name,
      status: ghData.status,                   // queued, in_progress, completed
      conclusion: ghData.conclusion || "pending",
      url: ghData.html_url,                    // GitHub run link
      cypressUrl,                              // Cypress Cloud link
      env: ghData.name?.toLowerCase().includes("qa") ? "qa" : "dev",
      message: ghData.head_commit?.message || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
