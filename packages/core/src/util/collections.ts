/**
 * Group items by a key, preserving the order in which keys first appear.
 */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

/**
 * Round to two decimal places.
 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
