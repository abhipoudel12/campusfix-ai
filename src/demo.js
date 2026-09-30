// Demo-only facts. The selected scenario, never the uploaded image, supplies report details.
export const scenarios = Object.freeze({
  lighting: {
    label: 'Broken walkway lighting',
    title: 'Walkway lighting needs repair',
    category: 'Lighting',
    severity: 'High',
    hazard: true,
    recurring: false,
    description: 'A walkway light is out in the selected example scenario, reducing visibility after dark.',
    action: 'Inspect the fixture and power supply; restore lighting and confirm the walkway is safely illuminated.'
  },
  trash: {
    label: 'Overflowing trash bin',
    title: 'Overflowing trash bin',
    category: 'Waste',
    severity: 'Low',
    hazard: false,
    recurring: true,
    description: 'A trash bin is overflowing in the selected example scenario.',
    action: 'Empty the bin, clean the surrounding area, and review the collection schedule.'
  },
  sidewalk: {
    label: 'Damaged sidewalk',
    title: 'Uneven sidewalk needs repair',
    category: 'Grounds',
    severity: 'High',
    hazard: true,
    recurring: false,
    description: 'An uneven section of sidewalk creates a trip hazard in the selected example scenario.',
    action: 'Mark the affected area, inspect the damage, and schedule a surface repair.'
  },
  leak: {
    label: 'Water leak',
    title: 'Water leak needs attention',
    category: 'Plumbing',
    severity: 'Medium',
    hazard: true,
    recurring: false,
    description: 'Water is leaking in the selected example scenario and may make the floor slippery.',
    action: 'Contain the water, locate the source, and repair the leak.'
  }
});

const severityPoints = { Low: 25, Medium: 50, High: 70 };
const hazardPoints = 15;
const recurringPoints = 5;

// Triage aid only: severity base + 15 for a hazard + 5 for a recurring issue, capped at 100.
// This is a demo heuristic, not a validated safety assessment.
export function calculateScore(scenario) {
  return scoreBreakdown(scenario).total;
}

export function scoreBreakdown(scenario) {
  if (!(scenario.severity in severityPoints)) throw new Error('Unknown severity');
  const severity = severityPoints[scenario.severity];
  const hazard = scenario.hazard ? hazardPoints : 0;
  const recurring = scenario.recurring ? recurringPoints : 0;
  return { severity, hazard, recurring, total: Math.min(100, severity + hazard + recurring) };
}

export function createDemoReport({ scenarioKey, location, notes = '', id = crypto.randomUUID(), createdAt = new Date().toISOString() }) {
  const scenario = scenarios[scenarioKey];
  if (!scenario) throw new Error('Choose a sample scenario');
  const cleanLocation = location.trim();
  if (!cleanLocation) throw new Error('Enter a building or location');
  return {
    id, createdAt, scenarioKey,
    title: scenario.title,
    location: cleanLocation,
    category: scenario.category,
    severity: scenario.severity,
    description: scenario.description,
    action: scenario.action,
    score: calculateScore(scenario),
    status: 'Open',
    notes: notes.trim()
  };
}

export const statuses = Object.freeze(['Open', 'In progress', 'Resolved']);

export function updateReportStatus(reports, id, status) {
  if (!statuses.includes(status)) throw new Error('Invalid status');
  return reports.map((report) => report.id === id ? { ...report, status } : report);
}

export function selectReports(reports, { status = 'All', sort = 'highest' } = {}) {
  if (status !== 'All' && !statuses.includes(status)) throw new Error('Invalid filter');
  const selected = reports.filter((report) => status === 'All' || report.status === status);
  return [...selected].sort((a, b) => sort === 'lowest'
    ? a.score - b.score || a.createdAt.localeCompare(b.createdAt)
    : b.score - a.score || b.createdAt.localeCompare(a.createdAt));
}
