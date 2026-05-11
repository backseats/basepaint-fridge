export type Palette = Record<number, string>;

export interface BasepaintTheme {
  day: string;
  theme: string;
  proposer: string;
  size: number;
  palette: Palette;
  hexColors: string[];
}

type BasepaintThemeResponse = {
  theme?: unknown;
  proposer?: unknown;
  size?: unknown;
  palette?: unknown;
};

const BASEPAINT_THEME_API_URL = "https://basepaint.xyz/api/theme";
const HEX_COLOR_PATTERN = /^#[a-fA-F0-9]{6}$/;

export const basePalette: Palette = {
  0: "#49e7ec",
  1: "#3368dc",
  2: "#2b0f54",
  3: "#ab1f65",
  4: "#ff4f69",
  5: "#ff8142",
  6: "#ffda45",
  7: "#fff7f8",
};

const themeCache = new Map<string, Promise<BasepaintTheme>>();

export function basepaintThemeUrl(day: string) {
  return `${BASEPAINT_THEME_API_URL}/${encodeURIComponent(day)}`;
}

function parseThemeDay(value: string) {
  const day = value.trim();

  if (!/^\d+$/.test(day)) {
    throw new Error("Day must be a positive integer");
  }

  return day;
}

function paletteFromHexColors(hexColors: string[]) {
  return hexColors.reduce<Palette>((palette, color, index) => {
    palette[index] = color.toLowerCase();
    return palette;
  }, {});
}

function parseBasepaintTheme(day: string, payload: BasepaintThemeResponse) {
  if (!Array.isArray(payload.palette)) {
    throw new Error("BasePaint theme response did not include a palette");
  }

  const hexColors = payload.palette.map((color) => {
    if (typeof color !== "string" || !HEX_COLOR_PATTERN.test(color)) {
      throw new Error("BasePaint theme response included an invalid color");
    }

    return color.toLowerCase();
  });

  if (hexColors.length === 0) {
    throw new Error("BasePaint theme response included an empty palette");
  }

  return {
    day,
    theme: typeof payload.theme === "string" ? payload.theme : `Day ${day}`,
    proposer: typeof payload.proposer === "string" ? payload.proposer : "",
    size: typeof payload.size === "number" ? payload.size : 0,
    palette: paletteFromHexColors(hexColors),
    hexColors,
  };
}

async function requestBasepaintTheme(day: string) {
  const response = await fetch(basepaintThemeUrl(day), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`BasePaint theme request failed (${response.status})`);
  }

  return parseBasepaintTheme(
    day,
    (await response.json()) as BasepaintThemeResponse,
  );
}

export function fetchBasepaintTheme(dayValue: string) {
  const day = parseThemeDay(dayValue);
  const cachedTheme = themeCache.get(day);

  if (cachedTheme) {
    return cachedTheme;
  }

  const themeRequest = requestBasepaintTheme(day).catch((error) => {
    themeCache.delete(day);
    throw error;
  });

  themeCache.set(day, themeRequest);
  return themeRequest;
}
