export function mergeReportPage(existing, incoming, newestFirst = false) {
  const ordered = newestFirst ? [...incoming, ...existing] : [...existing, ...incoming];
  const ids = new Set();
  return ordered.filter((report) => {
    if (ids.has(report.id)) return false;
    ids.add(report.id);
    return true;
  });
}
