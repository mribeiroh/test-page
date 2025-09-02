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

  try {
    // 1. Fetch latest workflow runs
    const ghRes = await fetch(
      "https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs?branch=main&per_page=10",
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const ghData = await ghRes.json();
    if (!ghRes.ok || !Array.isArray(ghData.workflow_runs)) {
      return res.status(ghRes.status).json({ error: ghData });
    }

    // 2. Get Cypress runs (faster than scraping logs for all)
    let cypressRuns = [];
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
        cypressRuns = ccData.runs || [];
      }
    } catch (err) {
      console.warn("⚠️ Failed to fetch Cypress Cloud runs:", err.message);
    }

    // 3. Map runs with Cypress Cloud URL
    const runs = await Promise.all(
      ghData.workflow_runs.map(async (run) => {
        const sha = run.head_sha;
        let cypressUrl = null;

        // (a) Try Cypress API first
        if (sha) {
          const match = cypressRuns.find(r => r.commit?.sha === sha);
          if (match) {
            cypressUrl = match.url;
          }
        }

        // (b) Fallback: scrape logs with JSZip if Cypress API didn’t match
        if (!cypressUrl) {
          try {
            const logsRes = await fetch(
              `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs/${run.id}/logs`,
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
            console.warn(`⚠️ Failed to parse logs for run ${run.id}:`, err.message);
          }
        }

        return {
          id: run.id,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          url: run.html_url,
          cypressUrl,
          env: run.name?.toLowerCase().includes("qa") ? "qa" : "dev"
        };
      })
    );

    // 4. Return enriched history
    return res.status(200).json({ success: true, runs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
