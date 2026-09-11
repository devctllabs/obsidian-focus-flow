import { expect } from 'storybook/test';

export async function expectChildrenInside(control: HTMLElement) {
  const bounds = control.getBoundingClientRect();
  for (const child of Array.from(control.children)) {
    const rect = child.getBoundingClientRect();
    await expect(rect.top, `${control.getAttribute('aria-label')}: ${child.textContent}`).toBeGreaterThanOrEqual(bounds.top - 1);
    await expect(rect.bottom, `${control.getAttribute('aria-label')}: ${child.textContent}`).toBeLessThanOrEqual(bounds.bottom + 1);
  }
}
