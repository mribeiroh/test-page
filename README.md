# Polaris Test Automation Dashboard

A lightweight **GitHub Pages + Vercel integration** to trigger and monitor **GitHub Actions workflows** for different environments (DEV and QA).

## 🚀 Features
- Trigger **GitHub Actions workflows** directly from a webpage.
- Select environment (**DEV** or **QA**) before running tests.
- Track the **Current Workflow Status** (the one you triggered).
- Display the **Latest Workflow Status** (the most recent run that is not your current one).
- View **Run History** with clickable links to GitHub.
- Auto-refreshes every 15s for live updates.

## 📂 Project Structure
.
├── public/ # GitHub Pages frontend (HTML/JS)
├── api/ # Vercel serverless API endpoints
│ ├── trigger.js # Triggers a workflow (dev.yml or qa.yml)
│ ├── status.js # Returns latest runs (for "Latest Status")
│ ├── history.js # Returns last 10 runs
│ └── run/[id].js # Returns details of a single run
└── README.md


## ⚙️ How It Works
1. **Frontend (GitHub Pages)**  
   A static HTML page with:
   - Env selector (`dev` or `qa`)  
   - "Run Workflow" button  
   - Current + Latest + History sections  

2. **Backend (Vercel)**  
   - Uses serverless functions (`/api/*`)  
   - Communicates with GitHub REST API  
   - Requires a GitHub **Personal Access Token (PAT)** stored as `GITHUB_TOKEN` in Vercel **Environment Variables**.
