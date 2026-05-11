import { z } from 'zod';
import {
  MAX_COMMENT_LENGTH,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from './types/domain';

export const profileSchema = z.object({
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80).default('Coimbra'),
  birthdate: z.coerce.date().refine((d) => {
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    return d <= eighteenYearsAgo;
  }, 'Tens de ter 18 anos ou mais'),
  phone: z.string().optional(),
  photo_url: z.string().url().optional(),
});

export const teamSchema = z.object({
  name: z.string().min(2).max(80),
  sport_id: z.number().int().positive(),
  city: z.string().min(2).max(80).default('Coimbra'),
  photo_url: z.string().url().optional(),
});

export const matchProposalSchema = z.object({
  sport_id: z.number().int().positive(),
  scheduled_at: z.coerce.date().refine(
    (d) => d.getTime() > Date.now() + 24 * 60 * 60 * 1000,
    'O jogo tem de ser pelo menos 24h no futuro',
  ),
  location_name: z.string().max(200).optional(),
  location_tbd: z.boolean().default(false),
  message: z.string().max(500).optional(),
});

export const reviewSchema = z.object({
  fair_play: z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE),
  punctuality: z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE),
  technical_level: z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE),
  attitude: z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE),
  comment: z.string().max(MAX_COMMENT_LENGTH).optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type MatchProposalInput = z.infer<typeof matchProposalSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
