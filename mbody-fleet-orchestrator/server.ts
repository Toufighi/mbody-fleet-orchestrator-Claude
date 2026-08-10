import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { globalFleetScheduler } from './src/scheduler/optimizer';
import { globalHALRegistry } from './src/hal/HALRegistry';
import { FLEET_ROSTER } from './src/data/roster';
import { generateFleetAdvisorAnalysis, parseHospitalLogWithLLM, explainDecision, answerFleetQuestion } from './src/server/claudeAdvisor';
import { globalHumanFeedback } from './src/monitoring/humanFeedback';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Multi-OEM Fleet Orchestrator', timestamp: new Date().toISOString() });
  });

  // API Route: Generate Schedule
  app.post('/api/schedule/generate', (req, res) => {
    try {
      const { shiftDay = 'Tue', costWeight = 0.7, slaWeight = 0.3, adHocZone, planningMode = 'OR_DETERMINISTIC' } = req.body || {};
      const plan = globalFleetScheduler.generateSchedule({
        shiftDay,
        objectiveWeight: { cost: costWeight, sla: slaWeight },
        customAdHocZone: adHocZone,
        planningMode
      });
      res.json({ success: true, plan });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: HAL Translate Payload
  app.post('/api/hal/translate', (req, res) => {
    try {
      const { robotId, rawPayload } = req.body;
      const robotConfig = FLEET_ROSTER.find(r => r.id === robotId) || FLEET_ROSTER[0];
      const normalized = globalHALRegistry.normalizeTelemetry(rawPayload, robotConfig);
      res.json({ success: true, normalized });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // API Route: Claude AI Fleet Advisor
  app.post('/api/ai/advisor', async (req, res) => {
    try {
      const { disruptionContext } = req.body;
      const analysis = await generateFleetAdvisorAnalysis(disruptionContext);
      res.json({ success: true, analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Parse Hospital Log / Staff Report with Claude LLM
  app.post('/api/ai/parse-log', async (req, res) => {
    try {
      const { logText } = req.body;
      const parsed = await parseHospitalLogWithLLM(logText || '');
      res.json({ success: true, parsed });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: #1 — plain-language explanation of any scheduling/anomaly decision
  app.post('/api/ai/explain', async (req, res) => {
    try {
      const { context } = req.body;
      const explanation = await explainDecision(context);
      res.json({ success: true, explanation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: #2 — conversational fleet assistant, grounded in a shift snapshot
  app.post('/api/ai/assistant', async (req, res) => {
    try {
      const { question, shiftSnapshot, recentHistory } = req.body;
      const answer = await answerFleetQuestion(question, shiftSnapshot, recentHistory || []);
      res.json({ success: true, answer });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: #3 — scoped human-in-the-loop feedback (adjusts one persisted heuristic
  // parameter; see src/monitoring/humanFeedback.ts for the honest scope of this)
  app.get('/api/feedback/water-bias', async (req, res) => {
    try {
      const bias = await globalHumanFeedback.getWaterBias();
      res.json({ success: true, bias });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post('/api/feedback/water-bias', async (req, res) => {
    try {
      const { direction } = req.body; // 'too_aggressive' | 'too_conservative'
      const bias = await globalHumanFeedback.recordFeedback(direction);
      res.json({ success: true, bias });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Multi-OEM Fleet Orchestrator] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
