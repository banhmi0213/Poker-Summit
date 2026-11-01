/** Fisher–Yates: every banner appears once per cycle, with a random first slide. */
export function shuffleBannerIds(ids: readonly string[], random: () => number = Math.random): string[] {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
