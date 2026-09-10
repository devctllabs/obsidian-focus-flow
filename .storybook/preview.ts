import type { Preview } from '@storybook/react-vite';
import { createElement, useEffect, type ReactNode } from 'react';
import './obsidian-theme.css';
import '../styles.css';
import './preview.css';

function StorybookTheme({ theme, children }: { theme: string; children: ReactNode }) {
  useEffect(() => {
    const previousTheme = document.body.dataset.focusFlowTheme;
    document.body.dataset.focusFlowTheme = theme;

    return () => {
      if (previousTheme === undefined) {
        delete document.body.dataset.focusFlowTheme;
      } else {
        document.body.dataset.focusFlowTheme = previousTheme;
      }
    };
  }, [theme]);

  const classes = [
    'focus-flow-story-host',
    theme === 'light' ? 'theme-light' : 'theme-dark',
    theme === 'community' ? 'focus-flow-story-host--community' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createElement('div', { className: classes }, children);
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Focus Flow theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: ['light', 'dark', 'community'],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = String(context.globals.theme ?? 'light');
      return createElement(StorybookTheme, { theme, children: createElement(Story) });
    },
  ],
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
