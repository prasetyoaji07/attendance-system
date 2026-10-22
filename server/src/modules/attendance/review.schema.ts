import { z } from 'zod';
import { REVIEW_DECISIONS } from '../../core/risk-flags';

/** Param :id (id absen atau id selfie). */
export const reviewIdParams = z.object({ id: z.coerce.number().int().positive() });

/** Body POST /attendance/:id/review. Hanya dua keputusan; PENDING dan NOT_REQUIRED diset sistem. */
export const reviewDecisionSchema = z.object({ keputusan: z.enum(REVIEW_DECISIONS) });
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
