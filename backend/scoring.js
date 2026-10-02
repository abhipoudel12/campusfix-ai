export const statuses = ['Open', 'In progress', 'Resolved'];
export const categories = ['Lighting', 'Waste', 'Grounds', 'Plumbing', 'Building', 'Other'];
export const severities = ['Low', 'Medium', 'High'];

export function scoreBreakdown({ severity, hazard, recurring }) {
  const base = { Low: 25, Medium: 50, High: 70 }[severity];
  if (base === undefined || typeof hazard !== 'boolean' || typeof recurring !== 'boolean') throw new Error('Invalid score inputs');
  return { severity: base, hazard: hazard ? 15 : 0, recurring: recurring ? 5 : 0, total: Math.min(100, base + (hazard ? 15 : 0) + (recurring ? 5 : 0)) };
}

const boundedText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
export function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid model output');
  const keys = ['title', 'category', 'severity', 'hazard', 'recurring', 'description', 'action'];
  if (Object.keys(raw).sort().join(',') !== [...keys].sort().join(',')) throw new Error('Unexpected model output fields');
  if (!boundedText(raw.title, 100) || !categories.includes(raw.category) || !severities.includes(raw.severity)
    || typeof raw.hazard !== 'boolean' || typeof raw.recurring !== 'boolean'
    || !boundedText(raw.description, 400) || !boundedText(raw.action, 400)) throw new Error('Invalid model output values');
  return Object.fromEntries(keys.map((key) => [key, typeof raw[key] === 'string' ? raw[key].trim() : raw[key]]));
}
