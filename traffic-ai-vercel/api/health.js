module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    status: 'ok',
    service: 'TRAFFIC AI Backend',
    version: '1.0.0',
    grid: '3x3 (9 junctions, 400m segments)',
    controllers: ['fixed', 'adaptive'],
    timestamp: new Date().toISOString()
  }));
};
