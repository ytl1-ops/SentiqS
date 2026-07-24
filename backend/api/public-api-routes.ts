// Public REST API routes for SentiqS
import express, { Request, Response } from 'express';
import { IntegrationService } from './integration-service';
import { PublicApiAlert, PublicApiStats } from './integration-types';

const router = express.Router();

// Middleware: API key authentication
const authenticateApiKey = async (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const key = authHeader.substring(7);
  const apiKey = await IntegrationService.verifyApiKey(key);

  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check expiration
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'API key expired' });
  }

  // Attach to request
  req.user = { id: apiKey.userId };
  req.apiKey = apiKey;
  next();
};

// ─────── Public Endpoints ──────────

/**
 * GET /api/v1/alerts
 * List recent alerts
 */
router.get('/v1/alerts', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const severity = req.query.severity as string;
    const country = req.query.country as string;

    // Build query
    let query = supabase
      .from('alerts')
      .select('id,country,title,description,severity,category,createdAt,sourceUrl')
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) query = query.eq('severity', severity);
    if (country) query = query.eq('country', country);

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      data: data as PublicApiAlert[],
      pagination: { limit, offset, total: data?.length || 0 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/stats
 * Get alert statistics
 */
router.get('/v1/stats', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('severity, country')
      .eq('status', 'ACTIVE');

    if (error) throw error;

    const stats: PublicApiStats = {
      total: data?.length || 0,
      critical: data?.filter(a => a.severity === 'CRITIQUE').length || 0,
      elevated: data?.filter(a => a.severity === 'ÉLEVÉ').length || 0,
      moderate: data?.filter(a => a.severity === 'MODÉRÉ').length || 0,
      stable: data?.filter(a => a.severity === 'STABLE').length || 0,
      byCountry: {},
      timestamp: new Date().toISOString(),
    };

    data?.forEach(alert => {
      stats.byCountry[alert.country] = (stats.byCountry[alert.country] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/alerts
 * Create a new alert (webhook from external system)
 */
router.post('/v1/alerts', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { title, description, country, severity, category, sourceUrl } = req.body;

    if (!title || !country || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('alerts')
      .insert([{
        userId: req.user.id,
        title,
        description,
        country,
        severity,
        category: category || 'SÉCURITÉ',
        sourceUrl: sourceUrl || 'API',
        status: 'ACTIVE',
        channels: ['IN_APP'],
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/correlations
 * Get regional correlations
 */
router.get('/v1/correlations', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get alerts from last N hours
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('country, category, title')
      .gte('createdAt', sinceDate.toISOString())
      .eq('status', 'ACTIVE');

    if (error) throw error;

    // Group by category
    const correlations = {};
    alerts?.forEach(alert => {
      const key = alert.category;
      if (!correlations[key]) {
        correlations[key] = {
          category: key,
          countries: [],
          count: 0,
        };
      }
      if (!correlations[key].countries.includes(alert.country)) {
        correlations[key].countries.push(alert.country);
      }
      correlations[key].count++;
    });

    res.json({
      correlations: Object.values(correlations),
      timeWindow: `Last ${hours}h`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/integrations/{id}/test
 * Test integration connection
 */
router.post('/v1/integrations/:id/test', authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Send test alert
    const testAlert = {
      id: 'test',
      title: 'Integration Test',
      description: 'This is a test message',
      country: 'Test',
      severity: 'MODÉRÉ',
      category: 'SÉCURITÉ',
      createdAt: new Date().toISOString(),
    };

    await IntegrationService.sendToIntegration(integration, testAlert);
    res.json({ success: true, message: 'Test message sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
