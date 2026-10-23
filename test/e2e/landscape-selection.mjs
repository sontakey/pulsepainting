// Choose a repeatable composition in browser replay without changing production
// randomness or replacing the real acceptance adapter and source samples.
export async function selectReplayLandscape(page, family, seed) {
  await page.evaluate(({ family, seed }) => {
    const renderer = window.PulseLandscape;
    if (!renderer.FAMILIES.some(item => item.id === family)) throw new Error(`Unknown replay landscape: ${family}`);
    window.PulseLandscape = Object.freeze({
      ...renderer,
      create: (options = {}) => renderer.create({ family, seed, ...options }),
    });
  }, { family, seed });
}
