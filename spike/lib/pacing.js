// Human pacing for the spike: randomized gaps and viewport-locked scrolling.
// No daily caps (ADR-0004); this is about looking like a person, not about volume.
import { setTimeout as sleep } from 'node:timers/promises';

const rand = (min, max) => min + Math.random() * (max - min);

export const pause = (min = 1200, max = 3200) => sleep(rand(min, max));

export async function humanScroll(page, steps = 3) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.round(rand(250, 700)));
    await pause(400, 1100);
  }
}
