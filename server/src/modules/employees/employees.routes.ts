import { Router } from 'express';

export const employeesRoutes = Router();

// FASE 1: karyawan, divisi, atasan
// Pola file di modul ini: employees.routes.ts -> employees.controller.ts -> employees.service.ts -> employees.repository.ts
// Logika bisnis HANYA di service. Controller tipis. Validasi input pakai zod (core/middleware/validate).

employeesRoutes.get('/_ping', (_req, res) => res.json({ module: 'employees', status: 'stub' }));
