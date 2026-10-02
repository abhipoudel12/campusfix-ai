export const statuses = ['Open', 'In progress', 'Resolved'];
export const categories = ['Lighting', 'Waste', 'Grounds', 'Plumbing', 'Building', 'Other'];
export const severities = ['Low', 'Medium', 'High'];
export const analysisFields = ['title', 'category', 'severity', 'hazard', 'recurring', 'description', 'action'];
export const textLimits = { title: 100, description: 400, action: 400 };

export function scoreBreakdown({ severity, hazard, recurring }) {
  const base = { Low: 25, Medium: 50, High: 70 }[severity];
  if (base === undefined || typeof hazard !== 'boolean' || typeof recurring !== 'boolean') throw new Error('Invalid score inputs');
  return { severity: base, hazard: hazard ? 15 : 0, recurring: recurring ? 5 : 0, total: Math.min(100, base + (hazard ? 15 : 0) + (recurring ? 5 : 0)) };
}

const boundedText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const invalid = (code) => Object.assign(new Error('Invalid model output'), { code });
const canonicalEnum = (value, allowed) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return allowed.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
};

export function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('content_shape');
  const keys = Object.keys(raw);
  if (analysisFields.some((key) => !keys.includes(key))) throw invalid('missing_fields');
  if (keys.some((key) => !analysisFields.includes(key))) throw invalid('extra_fields');

  const normalized = {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title.trim() : raw.title,
    category: canonicalEnum(raw.category, categories),
    severity: canonicalEnum(raw.severity, severities),
    description: typeof raw.description === 'string' ? raw.description.trim() : raw.description,
    action: typeof raw.action === 'string' ? raw.action.trim() : raw.action,
  };
  const valid = {
    title: boundedText(normalized.title, textLimits.title),
    category: categories.includes(normalized.category),
    severity: severities.includes(normalized.severity),
    hazard: typeof normalized.hazard === 'boolean',
    recurring: typeof normalized.recurring === 'boolean',
    description: boundedText(normalized.description, textLimits.description),
    action: boundedText(normalized.action, textLimits.action),
  };
  const invalidField = analysisFields.find((key) => !valid[key]);
  if (invalidField) throw invalid(`invalid_${invalidField}`);
  return Object.fromEntries(analysisFields.map((key) => [key, normalized[key]]));
}
