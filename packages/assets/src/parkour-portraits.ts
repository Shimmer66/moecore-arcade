/** Small portraits are rendered at 42 × 52 px in the runner's dialogue. */
export const PARKOUR_PORTRAITS = {
  portrait_neutral: new URL(
    '../whale-runner/portraits-small/portrait_neutral.webp',
    import.meta.url,
  ).href,
  portrait_confident: new URL(
    '../whale-runner/portraits-small/portrait_confident.webp',
    import.meta.url,
  ).href,
  portrait_defensive: new URL(
    '../whale-runner/portraits-small/portrait_defensive.webp',
    import.meta.url,
  ).href,
  portrait_guilty: new URL('../whale-runner/portraits-small/portrait_guilty.webp', import.meta.url)
    .href,
  portrait_startled: new URL(
    '../whale-runner/portraits-small/portrait_startled.webp',
    import.meta.url,
  ).href,
  portrait_thinking: new URL(
    '../whale-runner/portraits-small/portrait_thinking.webp',
    import.meta.url,
  ).href,
  portrait_facepalm: new URL(
    '../whale-runner/portraits-small/portrait_facepalm.webp',
    import.meta.url,
  ).href,
  portrait_happy: new URL('../whale-runner/portraits-small/portrait_happy.webp', import.meta.url)
    .href,
  portrait_receipt: new URL(
    '../whale-runner/portraits-small/portrait_receipt.webp',
    import.meta.url,
  ).href,
} as const;
