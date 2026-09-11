import type { Decorator } from '@storybook/react-vite';

export type HostFrame = 'leaf' | 'sidebar' | 'modal' | 'settings';

export const withHostFrame = (frame: HostFrame): Decorator => (Story) => (
  <div className={`focus-flow-story-frame focus-flow-story-frame--${frame}`}>
    <div className="focus-flow focus-flow--storybook-boundary">
      <Story />
    </div>
  </div>
);
