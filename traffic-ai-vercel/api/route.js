const { findShortestRoute } = require('./_engine');

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const start = body.start || 'A1';
  const end = body.end || 'C3';
  const vehicle = body.vehicle || 'Ambulance';
  const queues = body.queues || {};

  const route = findShortestRoute(start, end, queues);
  if (route.error) {
    res.statusCode = 400;
    res.end(JSON.stringify(route));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({
    vehicle,
    start,
    end,
    ...route,
    timeSavedSeconds: Math.max(0, route.baselineSeconds - route.estimatedSeconds)
  }));
};
