import path from 'node:path';

const mobileProfile = process.env.OBSIDIAN_E2E_PROFILE === 'mobile';

export const config: WebdriverIO.Config = {
  runner: 'local',
  framework: 'mocha',
  specs: [
    mobileProfile
      ? './test/e2e/mobile.e2e.ts'
      : './test/e2e/focus-flow.e2e.ts',
  ],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'obsidian',
      'wdio:obsidianOptions': {
        appVersion: process.env.OBSIDIAN_APP_VERSION ?? 'latest',
        installerVersion: process.env.OBSIDIAN_INSTALLER_VERSION ?? 'earliest',
        plugins: ['.'],
        vault: mobileProfile
          ? 'test/vaults/mobile-smoke'
          : 'test/vaults/smoke',
        emulateMobile: mobileProfile,
      },
      ...(mobileProfile
        ? {
            'goog:chromeOptions': {
              mobileEmulation: {
                deviceMetrics: { width: 390, height: 844 },
              },
            },
          }
        : {}),
    },
  ],
  services: ['obsidian'],
  reporters: ['obsidian'],
  cacheDir: path.resolve('.obsidian-cache'),
  mochaOpts: {
    ui: 'bdd',
    timeout: 30_000,
  },
  waitforInterval: 100,
  waitforTimeout: 3_000,
  logLevel: 'warn',
  injectGlobals: false,
};
