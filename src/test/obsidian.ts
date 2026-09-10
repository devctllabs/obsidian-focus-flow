export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/$/, '');
}

export class TFile {
  constructor(readonly path = '') {}
}

export class TFolder {
  constructor(readonly path = '') {}
}

export const Keymap = {
  isModEvent(event: MouseEvent | KeyboardEvent): boolean {
    return event.metaKey || event.ctrlKey;
  },
};

export const Platform = {
  isDesktop: true,
  isMobile: false,
  isDesktopApp: true,
  isMobileApp: false,
  isIosApp: false,
  isAndroidApp: false,
};
