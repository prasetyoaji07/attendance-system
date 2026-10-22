import type { Request, Response } from 'express';
import { auditFn, runInTransaction } from '../../core/db-helpers';
import type { ReviewDecisionInput } from './review.schema';
import { reviewRepository } from './review.repository';
import { createReviewService } from './review.service';
import { selfieStorage } from './selfie-runtime';

const service = createReviewService({ repo: reviewRepository, storage: selfieStorage, runInTransaction, audit: auditFn });

export async function listReviews(_req: Request, res: Response) {
  const data = await service.listPending();
  res.set('Cache-Control', 'no-store');
  res.status(200).json({ data });
}

export async function getSelfie(_req: Request, res: Response) {
  const { id } = res.locals.params as { id: number };
  const { bytes } = await service.getSelfie(id);
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'no-store');
  res.status(200).send(bytes);
}

export async function markReview(req: Request, res: Response) {
  const { id } = res.locals.params as { id: number };
  const { keputusan } = res.locals.body as ReviewDecisionInput;
  await service.mark(id, keputusan, req.user!);
  res.status(200).json({ data: { attendanceId: id, reviewStatus: keputusan } });
}
