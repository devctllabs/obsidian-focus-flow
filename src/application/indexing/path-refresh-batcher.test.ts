import { afterEach, describe, expect, it, vi } from 'vitest';
import { PathRefreshBatcher } from './path-refresh-batcher';

describe('PathRefreshBatcher', () => {
  afterEach(() => vi.useRealTimers());

  it('refreshes one accumulated batch after the first event in a burst', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const batcher = new PathRefreshBatcher(refresh, 100);

    batcher.schedule('Focus Flow/Inbox/FF-1.md');
    vi.advanceTimersByTime(90);
    batcher.schedule(
      'Focus Flow/Inbox/FF-1.md',
      'Focus Flow/Stories/FF-2.md',
    );
    vi.advanceTimersByTime(10);

    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith([
      'Focus Flow/Inbox/FF-1.md',
      'Focus Flow/Stories/FF-2.md',
    ]);
  });

  it('cancels a pending batch when its owner is disposed', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const batcher = new PathRefreshBatcher(refresh, 100);

    batcher.schedule('Focus Flow/Inbox/FF-1.md');
    batcher.dispose();
    vi.runAllTimers();

    expect(refresh).not.toHaveBeenCalled();
  });
});
