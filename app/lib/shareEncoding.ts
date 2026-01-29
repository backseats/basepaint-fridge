/**
 * Share URL Encoding/Decoding
 *
 * Encodes placed magnets into a compact URL-safe string.
 *
 * Format per magnet (5 bytes):
 * - 2 bytes: magnet index (0-65535)
 * - 1 byte: x position (0-255)
 * - 1 byte: y position (0-255)
 * - 1 byte: scale (0-255, maps to 0.25-4.0)
 *
 * Total: 5 bytes per magnet → ~7 chars base64 per magnet
 * 10 magnets = ~70 chars, very URL-friendly
 */

export interface EncodedMagnet {
  magnetIndex: number;
  x: number;
  y: number;
  scale: number;
}

// Scale range: 0.25 to 4.0 mapped to 0-255
const SCALE_MIN = 0.25;
const SCALE_MAX = 4.0;

function scaleToBytes(scale: number): number {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
  return Math.round(((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 255);
}

function bytesToScale(byte: number): number {
  return SCALE_MIN + (byte / 255) * (SCALE_MAX - SCALE_MIN);
}

/**
 * Encode placed magnets into a URL-safe base64 string
 */
export function encodeShareState(magnets: EncodedMagnet[]): string {
  const bytes = new Uint8Array(magnets.length * 5);

  magnets.forEach((m, i) => {
    const offset = i * 5;
    // Magnet index as 2 bytes (big endian)
    bytes[offset] = (m.magnetIndex >> 8) & 0xff;
    bytes[offset + 1] = m.magnetIndex & 0xff;
    // Position (clamped to 0-255)
    bytes[offset + 2] = Math.max(0, Math.min(255, Math.round(m.x)));
    bytes[offset + 3] = Math.max(0, Math.min(255, Math.round(m.y)));
    // Scale
    bytes[offset + 4] = scaleToBytes(m.scale);
  });

  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode a share string back into magnet placements
 */
export function decodeShareState(encoded: string): EncodedMagnet[] {
  // Restore base64 padding and characters
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const magnets: EncodedMagnet[] = [];
  for (let i = 0; i < bytes.length; i += 5) {
    if (i + 4 >= bytes.length) break;

    magnets.push({
      magnetIndex: (bytes[i] << 8) | bytes[i + 1],
      x: bytes[i + 2],
      y: bytes[i + 3],
      scale: bytesToScale(bytes[i + 4]),
    });
  }

  return magnets;
}

/**
 * Generate a share URL for the current fridge state
 */
export function generateShareUrl(
  baseUrl: string,
  magnets: EncodedMagnet[]
): string {
  if (magnets.length === 0) return baseUrl;
  const encoded = encodeShareState(magnets);
  return `${baseUrl}/share?s=${encoded}`;
}
