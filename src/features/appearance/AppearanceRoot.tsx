import {
  createContext,
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  DEFAULT_ACCENT_PREFERENCE,
  customAccentPalettes,
  type AccentPreference,
  type AppearanceController,
} from './appearance';

const AppearanceContext = createContext<AppearanceController | null>(null);
const subscribeFallback = () => () => undefined;
const getFallback = () => DEFAULT_ACCENT_PREFERENCE;

export function AppearanceRoot({
  appearance,
  children,
  className,
  element: Element = 'div',
}: {
  appearance: AppearanceController;
  children: ReactNode;
  className: string;
  element?: 'div' | 'main';
}) {
  return (
    <AppearanceProvider appearance={appearance}>
      <AppearanceElement className={className} element={Element}>
        {children}
      </AppearanceElement>
    </AppearanceProvider>
  );
}

export function AppearanceProvider({ appearance, children }: {
  appearance?: AppearanceController;
  children: ReactNode;
}) {
  return <AppearanceContext.Provider value={appearance ?? null}>{children}</AppearanceContext.Provider>;
}

export function useAccentPreference(): AccentPreference {
  const appearance = useContext(AppearanceContext);
  return useSyncExternalStore(
    appearance?.subscribe ?? subscribeFallback,
    appearance?.getSnapshot ?? getFallback,
    appearance?.getSnapshot ?? getFallback,
  );
}

export function accentAttributes(preference: AccentPreference): {
  'data-ff-accent': AccentPreference['source'];
  style?: CSSProperties;
} {
  if (preference.source !== 'custom') {
    return { 'data-ff-accent': preference.source };
  }
  const palettes = customAccentPalettes(preference.seed);
  return {
    'data-ff-accent': 'custom',
    style: {
      '--ff-custom-light-text': palettes.light.text,
      '--ff-custom-light-solid': palettes.light.solid,
      '--ff-custom-light-hover': palettes.light.hover,
      '--ff-custom-light-focus': palettes.light.focus,
      '--ff-custom-light-on-solid': palettes.light.onSolid,
      '--ff-custom-dark-text': palettes.dark.text,
      '--ff-custom-dark-solid': palettes.dark.solid,
      '--ff-custom-dark-hover': palettes.dark.hover,
      '--ff-custom-dark-focus': palettes.dark.focus,
      '--ff-custom-dark-on-solid': palettes.dark.onSolid,
    } as CSSProperties,
  };
}

function AppearanceElement({ children, className, element: Element }: {
  children: ReactNode;
  className: string;
  element: 'div' | 'main';
}) {
  const preference = useAccentPreference();
  return <Element className={className} {...accentAttributes(preference)}>{children}</Element>;
}
