// utils/store.js

let runs = [];

export function addRun(id, runData) {
  // Avoid duplicates, update if exists
  runs = runs.filter(r => r.id !== id);
  runs.unshift(runData); // add new at top
  if (runs.length > 20) runs.pop(); // keep history short
}

export function getRuns() {
  return runs;
}

export function getRun(id) {
  return runs.find(r => String(r.id) === String(id));
}
