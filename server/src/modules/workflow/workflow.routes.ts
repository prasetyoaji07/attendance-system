import { Router } from 'express';

export const workflowRoutes = Router();

// FASE 3: engine approval generik (workflow_templates, workflow_steps)
// Pola file di modul ini: workflow.routes.ts -> workflow.controller.ts -> workflow.service.ts -> workflow.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

workflowRoutes.get('/_ping', (_req, res) => res.json({ module: 'workflow', status: 'stub' }));
