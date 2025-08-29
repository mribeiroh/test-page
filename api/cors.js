// utils/cors.js (put this inside your api/ folder or utils/)
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://marcoshioka.github.io"); 
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}
