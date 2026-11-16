module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const samples = Array.isArray(body.samples) ? body.samples : [];
  const header = 'time_s,total_queue,avg_wait_s,avg_speed_kmh,throughput,congestion_level,active_incidents';
  const rows = samples.map((s) =>
    [
      Number(s.timeSec) || 0,
      Number(s.totalQueue) || 0,
      Number(s.avgWait) || 0,
      Number(s.avgSpeed) || 0,
      Number(s.throughput) || 0,
      `"${String(s.congestion || 'Smooth').replace(/"/g, '""')}"`,
      Number(s.activeIncidents) || 0
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="traffic-ai-report.csv"');
  res.statusCode = 200;
  res.end(csv);
};
