/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      comment: 'Keep the module graph acyclic.',
      severity: 'warn',
      from: { path: '^src' },
      to: { circular: true },
    },
    {
      name: 'domain-not-to-host-or-ui',
      comment: 'The domain layer stays host-agnostic and UI-independent.',
      severity: 'warn',
      from: { path: '^src/domain' },
      to: {
        path: [
          '^src/(obsidian|features)',
          '^node_modules/(obsidian|react|react-dom)(/|$)',
        ],
      },
    },
    {
      name: 'application-not-to-host-or-ui',
      comment: 'Application services depend on domain contracts, not delivery adapters.',
      severity: 'warn',
      from: { path: '^src/application' },
      to: {
        path: [
          '^src/(obsidian|features)',
          '^node_modules/(obsidian|react|react-dom)(/|$)',
        ],
      },
    },
    {
      name: 'features-not-to-host',
      comment: 'Feature views consume application contracts instead of Obsidian APIs.',
      severity: 'warn',
      from: { path: '^src/features' },
      to: {
        path: [
          '^src/obsidian',
          '^node_modules/obsidian(/|$)',
        ],
      },
    },
  ],
  options: {
    doNotFollow: ['node_modules'],
    exclude: ['(^|/)src/test/', '\\.(test|stories)\\.[jt]sx?$'],
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
