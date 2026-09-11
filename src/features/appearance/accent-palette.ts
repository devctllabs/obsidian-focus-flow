interface AccentRolePalette {
  text: string;
  solid: string;
  hover: string;
  focus: string;
  onSolid: string;
}

interface AccentPalettes {
  light: AccentRolePalette;
  dark: AccentRolePalette;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Oklch {
  lightness: number;
  chroma: number;
  hue: number;
}

const LIGHT_SURFACES = ['#FFFFFF', '#F5F6F8'] as const;
const DARK_SURFACES = ['#17191E', '#22252C'] as const;

export function customAccentPalettes(seed: string): AccentPalettes {
  const color = hexToOklch(seed);
  return {
    light: createPalette(color, LIGHT_SURFACES, ['#FFFFFF', '#1D2939']),
    dark: createPalette(color, DARK_SURFACES, ['#EDF0F5', '#17191E']),
  };
}

export function contrastRatio(left: string, right: string): number {
  const leftLuminance = relativeLuminance(hexToRgb(left));
  const rightLuminance = relativeLuminance(hexToRgb(right));
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function createPalette(
  seed: Oklch,
  surfaces: readonly [string, string],
  foregrounds: readonly [string, string],
): AccentRolePalette {
  const [background, alternate] = surfaces;
  const text = nearestTone(seed, (candidate) =>
    contrastRatio(candidate, background) >= 4.52 &&
    contrastRatio(candidate, alternate) >= 4.52,
  );
  const focus = nearestTone(seed, (candidate) =>
    contrastRatio(candidate, background) >= 3.02 &&
    contrastRatio(candidate, alternate) >= 3.02,
  );
  const solid = nearestTone(seed, (candidate) =>
    contrastRatio(candidate, background) >= 3.02 &&
    bestForeground(candidate, foregrounds).ratio >= 4.52,
  );
  const onSolid = bestForeground(solid, foregrounds).color;
  const solidOklch = hexToOklch(solid);
  const movesDarker = relativeLuminance(hexToRgb(solid)) < relativeLuminance(hexToRgb(background));
  const hoverSeed = {
    ...solidOklch,
    lightness: clamp(solidOklch.lightness + (movesDarker ? -0.06 : 0.06)),
  };
  const hover = nearestTone(hoverSeed, (candidate) =>
    contrastRatio(candidate, background) >= 3.02 &&
    contrastRatio(candidate, onSolid) >= 4.52,
  );
  return { text, solid, hover, focus, onSolid };
}

function nearestTone(
  seed: Oklch,
  accepts: (candidate: string) => boolean,
): string {
  let best = oklchToHex(seed);
  let distance = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= 500; step += 1) {
    const lightness = step / 500;
    const candidate = oklchToHex({ ...seed, lightness });
    const candidateDistance = Math.abs(lightness - seed.lightness);
    if (candidateDistance < distance && accepts(candidate)) {
      best = candidate;
      distance = candidateDistance;
    }
  }
  return best;
}

function bestForeground(
  background: string,
  foregrounds: readonly [string, string],
): { color: string; ratio: number } {
  const first = { color: foregrounds[0], ratio: contrastRatio(foregrounds[0], background) };
  const second = { color: foregrounds[1], ratio: contrastRatio(foregrounds[1], background) };
  return first.ratio >= second.ratio ? first : second;
}

function hexToOklch(hex: string): Oklch {
  const rgb = hexToRgb(hex);
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  const lRoot = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mRoot = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sRoot = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const labB = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  return {
    lightness,
    chroma: Math.hypot(a, labB),
    hue: Math.atan2(labB, a),
  };
}

function oklchToHex(color: Oklch): string {
  let low = 0;
  let high = color.chroma;
  let rgb = rawOklchToRgb(color);
  if (!inGamut(rgb)) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const chroma = (low + high) / 2;
      const candidate = rawOklchToRgb({ ...color, chroma });
      if (inGamut(candidate)) {
        low = chroma;
        rgb = candidate;
      } else {
        high = chroma;
      }
    }
  }
  return rgbToHex(rgb);
}

function rawOklchToRgb(color: Oklch): Rgb {
  const a = color.chroma * Math.cos(color.hue);
  const b = color.chroma * Math.sin(color.hue);
  const lRoot = color.lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = color.lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = color.lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  return {
    r: encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16) / 255,
    g: Number.parseInt(hex.slice(3, 5), 16) / 255,
    b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function rgbToHex(rgb: Rgb): string {
  const channel = (value: number) => Math.round(clamp(value) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

function linearize(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encode(value: number): number {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function inGamut(rgb: Rgb): boolean {
  return [rgb.r, rgb.g, rgb.b].every((value) => value >= 0 && value <= 1);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
