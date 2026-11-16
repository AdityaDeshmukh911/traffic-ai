const { runHeadToHead } = require('./_engine');

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

  const result = runHeadToHead({
    scenario: body.scenario || 'normal',
    seed: body.seed !== undefined ? Number(body.seed) : 42,
    duration: body.duration !== undefined ? Number(body.duration) : 600,
    arrivalMultiplier: body.arrivalMultiplier !== undefined ? Number(body.arrivalMultiplier) : 1.0,
    capacityRate: body.capacityRate !== undefined ? Number(body.capacityRate) : 0.85
  });

  res.statusCode = 200;
  res.end(JSON.stringify(result));
};
