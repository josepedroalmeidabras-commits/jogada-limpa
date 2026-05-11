export type Side = 'A' | 'B';
export type TeamRole = 'captain' | 'member';
export type MatchStatus =
  | 'proposed'
  | 'confirmed'
  | 'result_pending'
  | 'validated'
  | 'disputed'
  | 'cancelled';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type Attendance =
  | 'attended'
  | 'missed'
  | 'substitute_in'
  | 'substitute_out';
export type ReviewRole = 'opponent' | 'teammate';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export type SportCode = 'futebol5' | 'futebol7' | 'futebol11' | 'padel';

export interface ReviewScores {
  fair_play: number;
  punctuality: number;
  technical_level: number;
  attitude: number;
}

export const REVIEW_CATEGORIES = [
  'fair_play',
  'punctuality',
  'technical_level',
  'attitude',
] as const;

export const MIN_REVIEW_SCORE = 1;
export const MAX_REVIEW_SCORE = 5;
export const MAX_COMMENT_LENGTH = 200;
export const REVIEW_VISIBILITY_WINDOW_HOURS = 72;
