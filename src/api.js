export const apiBase = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');

export function createApi(base, fetcher = fetch) {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetcher(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
    } catch {
      throw new Error(options.method === 'POST'
        ? 'Connection lost during submission. Its outcome is unknown; check saved reports before submitting again.'
        : 'Could not connect to the report service. Check your connection and try loading reports again.');
    }
    let data;
    try { data = await response.json(); }
    catch { throw new Error('The report service returned an unreadable response.'); }
    if (!response.ok) {
      if (response.status === 409) throw new Error('This photo is already being processed. Check saved reports shortly.');
      if (response.status === 429) throw new Error('Today’s demo analysis limit has been reached.');
      if (response.status === 502) throw new Error('Photo analysis could not be completed. No report was saved.');
      throw new Error(typeof data.error === 'string' ? data.error : `Request failed (${response.status})`);
    }
    return data;
  }

  return {
    async listReports(cursor = null) {
      const data = await request(`/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      if (!Array.isArray(data.reports) || (data.nextCursor !== null && typeof data.nextCursor !== 'string')) {
        throw new Error('The report service returned an invalid report page.');
      }
      return data;
    },
    async submitReport(file, location, notes) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const data = await request('/reports', { method: 'POST', body: JSON.stringify({ imageBase64: btoa(binary), mimeType: file.type, location, notes }) });
      if (!data.report || typeof data.report.id !== 'string' || typeof data.duplicate !== 'boolean') {
        throw new Error('Submission returned an invalid report. Check saved reports before submitting again.');
      }
      return data;
    }
  };
}

export const { listReports, submitReport } = createApi(apiBase);
