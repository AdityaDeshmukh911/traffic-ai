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

  const name = (body.name || 'Demo Operator').toString().trim().slice(0, 60) || 'Demo Operator';
  const role = body.role === 'Evaluator' ? 'Evaluator' : 'Operator';

  res.statusCode = 200;
  res.end(JSON.stringify({
    authenticated: true,
    sessionMode: 'demo',
    user: {
      name,
      role,
      signedInAt: new Date().toISOString()
    },
    note: 'Simulated demo session — no real accounts or personal data are stored.'
  }));
};
