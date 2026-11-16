// Shared deterministic simulation & routing engine for TRAFFIC AI
// Used by Vercel Serverless Functions (/api/*)

const JUNCTION_IDS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

const SCENARIOS = {
  quiet:  { label: 'Quiet roads', baseArrival: 0.14, asymmetry: 1.45 },
  normal: { label: 'Normal day',  baseArrival: 0.28, asymmetry: 1.35 },
  rush:   { label: 'Rush hour',   baseArrival: 0.46, asymmetry: 1.18 },
  jam:    { label: 'Heavy jam',   baseArrival: 0.64, asymmetry: 1.08 }
};

// Main corridors: Row B (B1-B2-B3) and Col 2 (A2-B2-C2) carry heavier demand
const JUNCTION_WEIGHTS = {
  A1: { ns: 0.75, ew: 0.85 },
  A2: { ns: 1.25, ew: 0.85 },
  A3: { ns: 0.75, ew: 0.85 },
  B1: { ns: 0.80, ew: 1.35 },
  B2: { ns: 1.35, ew: 1.40 },
  B3: { ns: 0.80, ew: 1.30 },
  C1: { ns: 0.75, ew: 0.85 },
  C2: { ns: 1.25, ew: 0.85 },
  C3: { ns: 0.75, ew: 0.85 }
};

const ADJACENCY = {
  A1: ['A2', 'B1'],
  A2: ['A1', 'A3', 'B2'],
  A3: ['A2', 'B3'],
  B1: ['A1', 'B2', 'C1'],
  B2: ['A2', 'B1', 'B3', 'C2'],
  B3: ['A3', 'B2', 'C3'],
  C1: ['B1', 'C2'],
  C2: ['B2', 'C1', 'C3'],
  C3: ['B3', 'C2']
};

function mulberry32(seed) {
  let a = (Number(seed) || 42) >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poissonSample(lambda, rng) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 12);
  return k - 1;
}

function computeScore(queue, waitSec) {
  return 0.6 * (queue / 25) + 0.4 * (waitSec / 60);
}

function createInitialJunctions(rng) {
  const junctions = {};
  for (let i = 0; i < JUNCTION_IDS.length; i++) {
    const id = JUNCTION_IDS[i];
    const startPhase = i % 2 === 0 ? 'NS' : 'EW';
    junctions[id] = {
      id,
      queueNS: Math.floor(rng() * 5) + 1,
      queueEW: Math.floor(rng() * 6) + 2,
      phase: startPhase,
      light: 'GREEN',
      phaseElapsed: Math.floor(rng() * 8),
      nsWaitSec: startPhase === 'NS' ? 0 : 8,
      ewWaitSec: startPhase === 'EW' ? 0 : 8,
      capacityFactor: 1.0,
      lastReason: 'Initial green phase active'
    };
  }
  return junctions;
}

function runHeadToHead({
  scenario = 'normal',
  seed = 42,
  duration = 600,
  arrivalMultiplier = 1.0,
  capacityRate = 0.85
} = {}) {
  const sc = SCENARIOS[scenario] || SCENARIOS.normal;
  const steps = Math.max(60, Math.min(1800, Number(duration) || 600));
  const arrMult = Math.max(0.3, Math.min(2.5, Number(arrivalMultiplier) || 1.0));
  const cap = Math.max(0.3, Math.min(2.0, Number(capacityRate) || 0.85));

  // Pre-generate identical arrivals for both controllers using the same seed
  const arrivalRng = mulberry32(seed);
  const arrivals = new Array(steps);
  for (let t = 0; t < steps; t++) {
    const stepArr = {};
    // Slight directional wave so demand fluctuates naturally
    const wave = 1 + 0.25 * Math.sin(t / 45);
    for (const id of JUNCTION_IDS) {
      const w = JUNCTION_WEIGHTS[id];
      const lamNS = sc.baseArrival * arrMult * w.ns * (2 - wave * 0.5) / sc.asymmetry;
      const lamEW = sc.baseArrival * arrMult * w.ew * wave * sc.asymmetry;
      stepArr[id] = {
        ns: poissonSample(Math.max(0.02, lamNS), arrivalRng),
        ew: poissonSample(Math.max(0.02, lamEW), arrivalRng)
      };
    }
    arrivals[t] = stepArr;
  }

  function simulateController(mode) {
    const initRng = mulberry32((Number(seed) || 42) + 999);
    const junctions = createInitialJunctions(initRng);
    let totalCarSeconds = 0;
    let totalCarsEntered = 0;
    let totalThroughput = 0;
    let maxQueueObserved = 0;
    let queueSumAcrossSteps = 0;

    for (let t = 0; t < steps; t++) {
      const stepArr = arrivals[t];
      let stepQueue = 0;

      for (const id of JUNCTION_IDS) {
        const j = junctions[id];
        const a = stepArr[id];
        j.queueNS += a.ns;
        j.queueEW += a.ew;
        totalCarsEntered += a.ns + a.ew;

        // Signal state machine
        j.phaseElapsed += 1;
        if (j.phase === 'NS') {
          j.nsWaitSec = 0;
          j.ewWaitSec += 1;
        } else {
          j.ewWaitSec = 0;
          j.nsWaitSec += 1;
        }

        if (j.light === 'GREEN') {
          if (mode === 'fixed') {
            if (j.phaseElapsed >= 20) {
              j.light = 'YELLOW';
              j.phaseElapsed = 0;
            }
          } else {
            const curQ = j.phase === 'NS' ? j.queueNS : j.queueEW;
            const othQ = j.phase === 'NS' ? j.queueEW : j.queueNS;
            const curW = j.phase === 'NS' ? j.nsWaitSec : j.ewWaitSec;
            const othW = j.phase === 'NS' ? j.ewWaitSec : j.nsWaitSec;
            const curScore = computeScore(curQ, curW);
            const othScore = computeScore(othQ, othW);

            if (j.phaseElapsed >= 40) {
              j.light = 'YELLOW';
              j.phaseElapsed = 0;
            } else if (j.phaseElapsed >= 15 && othScore >= curScore + 0.25) {
              j.light = 'YELLOW';
              j.phaseElapsed = 0;
            }
          }
        } else if (j.light === 'YELLOW') {
          if (j.phaseElapsed >= 3) {
            j.light = 'ALL_RED';
            j.phaseElapsed = 0;
          }
        } else if (j.light === 'ALL_RED') {
          if (j.phaseElapsed >= 2) {
            j.phase = j.phase === 'NS' ? 'EW' : 'NS';
            j.light = 'GREEN';
            j.phaseElapsed = 0;
          }
        }

        // Departures only on GREEN
        if (j.light === 'GREEN') {
          // Deterministic fractional accumulator via step parity
          const depBase = Math.floor(cap);
          const frac = cap - depBase;
          const extra = ((t + id.charCodeAt(1)) % 100) < frac * 100 ? 1 : 0;
          const canLeave = depBase + extra;

          if (j.phase === 'NS' && j.queueNS > 0) {
            const left = Math.min(j.queueNS, canLeave);
            j.queueNS -= left;
            totalThroughput += left;
          } else if (j.phase === 'EW' && j.queueEW > 0) {
            const left = Math.min(j.queueEW, canLeave);
            j.queueEW -= left;
            totalThroughput += left;
          }
        }

        const qTotal = j.queueNS + j.queueEW;
        stepQueue += qTotal;
        if (qTotal > maxQueueObserved) maxQueueObserved = qTotal;
        totalCarSeconds += qTotal;
      }

      queueSumAcrossSteps += stepQueue;
    }

    const avgWait = totalCarsEntered > 0 ? totalCarSeconds / Math.max(1, totalThroughput + (queueSumAcrossSteps / steps)) : 0;
    const avgQueuePerJunction = queueSumAcrossSteps / (steps * JUNCTION_IDS.length);
    const avgSpeed = Math.max(8, Math.min(54, 48 - avgQueuePerJunction * 1.15));

    return {
      avgWait: Number(avgWait.toFixed(1)),
      maxQueue: maxQueueObserved,
      throughput: totalThroughput,
      avgSpeed: Number(avgSpeed.toFixed(1)),
      avgQueuePerJunction: Number(avgQueuePerJunction.toFixed(1))
    };
  }

  const fixed = simulateController('fixed');
  const adaptive = simulateController('adaptive');

  const waitDeltaPct = fixed.avgWait > 0
    ? Number((((adaptive.avgWait - fixed.avgWait) / fixed.avgWait) * 100).toFixed(1))
    : 0;

  const throughputDeltaPct = fixed.throughput > 0
    ? Number((((adaptive.throughput - fixed.throughput) / fixed.throughput) * 100).toFixed(1))
    : 0;

  let summary;
  if (waitDeltaPct <= -10) {
    summary = `Smart signals cut average wait by ${Math.abs(waitDeltaPct)}% on ${sc.label.toLowerCase()} because green time shifted toward busier queues.`;
  } else if (waitDeltaPct < 0) {
    summary = `Smart signals reduced average wait by ${Math.abs(waitDeltaPct)}% on ${sc.label.toLowerCase()}. Gains narrow when both directions stay heavily loaded.`;
  } else if (waitDeltaPct === 0) {
    summary = `Both controllers tied on ${sc.label.toLowerCase()} with seed ${seed}.`;
  } else {
    summary = `Timer signals edged ahead by ${waitDeltaPct}% in this specific seed, showing the honest simulated outcome without tuning.`;
  }

  return {
    scenario,
    scenarioLabel: sc.label,
    seed: Number(seed) || 42,
    duration: steps,
    fixed,
    adaptive,
    waitDeltaPct,
    throughputDeltaPct,
    summary
  };
}

function findShortestRoute(start, end, junctionQueues = {}) {
  if (!JUNCTION_IDS.includes(start) || !JUNCTION_IDS.includes(end)) {
    return { error: 'Invalid start or destination junction' };
  }
  const dist = {};
  const prev = {};
  const visited = new Set();

  for (const id of JUNCTION_IDS) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[start] = 0;

  while (visited.size < JUNCTION_IDS.length) {
    let u = null;
    let best = Infinity;
    for (const id of JUNCTION_IDS) {
      if (!visited.has(id) && dist[id] < best) {
        best = dist[id];
        u = id;
      }
    }
    if (u === null || u === end) break;
    visited.add(u);

    for (const v of ADJACENCY[u]) {
      if (visited.has(v)) continue;
      // Edge cost: 400m base (18s free-flow) + congestion penalty from destination queue
      const q = Number(junctionQueues[v]) || 0;
      const weight = 18 + Math.min(35, q * 0.65);
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  const path = [];
  let cur = end;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur];
  }

  const segments = Math.max(0, path.length - 1);
  return {
    path,
    distanceMeters: segments * 400,
    estimatedSeconds: Math.round(dist[end]),
    baselineSeconds: Math.round(dist[end] + segments * 11) // without signal preemption
  };
}

module.exports = {
  JUNCTION_IDS,
  SCENARIOS,
  ADJACENCY,
  runHeadToHead,
  findShortestRoute
};
