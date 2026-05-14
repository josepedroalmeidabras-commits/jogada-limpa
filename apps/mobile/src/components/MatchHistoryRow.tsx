import { MatchResultRow } from './MatchResultRow';
import type { DetailedMatchHistoryEntry } from '@/lib/history';

export function MatchHistoryRow({
  m,
  onPress,
}: {
  m: DetailedMatchHistoryEntry;
  onPress: () => void;
}) {
  return (
    <MatchResultRow
      scheduledAt={m.scheduled_at}
      isInternal={m.is_internal}
      status="validated"
      sideAName={m.side_a_name}
      sideBName={m.side_b_name}
      sideAPhoto={m.side_a_photo}
      sideBPhoto={m.side_b_photo}
      scoreA={m.final_score_a}
      scoreB={m.final_score_b}
      mySide={m.my_side}
      myGoals={m.my_goals}
      myAssists={m.my_assists}
      isMvp={m.is_mvp}
      onPress={onPress}
    />
  );
}
