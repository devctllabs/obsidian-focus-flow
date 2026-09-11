export function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareRank(
  leftRank: string,
  rightRank: string,
  leftId: string,
  rightId: string,
): number {
  const rankOrder = compareOrdinal(leftRank, rightRank);
  return rankOrder !== 0 ? rankOrder : compareOrdinal(leftId, rightId);
}
