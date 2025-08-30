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
    const ghRes = await fetch(
      `https://api.github.com/repos/daiichisankyo-polaris/polaris-qa-automation/actions/runs/${id}`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json"
        }
      }
    );

    const data = await ghRes.json();

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: data });
    }

    return res.status(200).json({
      id: data.id,
      name: data.name,
      status: data.status,
      conclusion: data.conclusion,
      url: data.html_url,
      env: data.name?.toLowerCase().includes("qa") ? "qa" : "dev"
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
