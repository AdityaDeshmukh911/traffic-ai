# TRAFFIC AI — Smart Traffic Signal Simulator

**Think Ahead. Move Smarter. Keep Cities Moving.**

TRAFFIC AI is a full-stack web-based smart traffic signal simulator built on a 3×3 city grid (9 junctions, 400 m road segments). It compares traditional **Fixed-Time (20 s / 20 s)** signals against a transparent **Adaptive (Smart) Signal Controller** on identical seeded traffic, computes **Dijkstra shortest-path ambulance routes** with safe signal preemption, simulates **capacity-reducing incidents**, and provides **live analytics, CO₂ estimates, and CSV export**.

> **Note:** All traffic, vehicles, queues, and incidents are simulated using a deterministic seeded queue model for learning and demonstration purposes.

---

## Features

- **Dashboard:** 6 plain-English summary cards, interactive 3×3 colour-coded junction map (Smooth / Busy / Heavy / Jammed), selected junction inspector, busiest junctions list, and live event feed.
- **Try It (Timer vs Smart):** Run both controllers on identical seeded traffic (`seed`, `scenario`, `duration`, `arrivalRate`, `capacity`) and inspect the honest side-by-side difference.
- **Smart Signals:** Top-down junction view with N–S and E–W queues, 3-lamp signal state machine (`Green 15–40 s → Yellow 3 s → All-Red 2 s`), live scoring formula breakdown, and *"Why is it doing this?"* explanation panel.
- **Ambulance Route:** Dijkstra shortest-path routing across the 3×3 grid with cyan corridor highlighting and safe signal preemption ahead of the emergency vehicle.
- **Incidents:** Report accidents, breakdowns, roadworks, or closures that reduce junction capacity until resolved, plus automatic congestion alerts when any junction queue reaches 30 cars.
- **Charts & Report:** Live time-series chart, queue-per-junction bar chart, editable CO₂ estimator, and 1-click CSV export.
- **How It Works:** Problem overview, scoring formula, Real vs Simulated limits table, and a 2-minute presentation script.

---

## Run Locally

Requires **Node.js 18+** (no `npm install` needed — zero external dependencies).

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel via GitHub

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial TRAFFIC AI simulator"
   git branch -M main
   git remote add origin https://github.com/<your-username>/traffic-ai.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new), import your GitHub repository, and click **Deploy** (zero build configuration required).
3. Vercel automatically serves `public/index.html` and deploys every file in `api/` as a Serverless Function (`/api/health`, `/api/auth`, `/api/simulate`, `/api/route`, `/api/incidents`, `/api/export`).

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Engine status & simulation metadata |
| `POST` | `/api/auth` | Demo operator sign-in session |
| `POST` | `/api/simulate` | Run seeded Fixed-Time vs Adaptive comparison |
| `POST` | `/api/route` | Compute Dijkstra emergency route on current grid |
| `GET / POST / PATCH` | `/api/incidents` | List, create, advance, resolve, or reopen incidents |
| `POST` | `/api/export` | Generate downloadable CSV report from simulation samples |
