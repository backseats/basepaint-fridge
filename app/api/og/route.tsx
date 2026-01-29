import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { decodeShareState } from '@/app/lib/shareEncoding';

// BasePaint color palette
const palette: { [key: number]: string } = {
  0: '#49e7ec',
  1: '#3368dc',
  2: '#2b0f54',
  3: '#ab1f65',
  4: '#ff4f69',
  5: '#ff8142',
  6: '#ffda45',
  7: '#fff7f8',
};

export const runtime = 'edge';

// OG image dimensions (3:2 aspect ratio as recommended by Farcaster)
const WIDTH = 1200;
const HEIGHT = 800;

// Fridge canvas is 256x256, we'll center it in the OG image
const CANVAS_SIZE = 600;
const CANVAS_OFFSET_X = (WIDTH - CANVAS_SIZE) / 2;
const CANVAS_OFFSET_Y = (HEIGHT - CANVAS_SIZE) / 2;

interface MagnetData {
  pixels: string;
  transactionHash: string;
}

// Parse pixel data to get bounding box and pixel info
function parsePixels(hexString: string) {
  const pixels: { x: number; y: number; colorIndex: number }[] = [];
  let minX = 256, minY = 256, maxX = 0, maxY = 0;

  for (let i = 0; i < hexString.length; i += 6) {
    const x = parseInt(hexString.slice(i, i + 2), 16);
    const y = parseInt(hexString.slice(i + 2, i + 4), 16);
    const colorIndex = parseInt(hexString.slice(i + 4, i + 6), 16);

    pixels.push({ x, y, colorIndex });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return { pixels, minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stateParam = searchParams.get('s');

  // Fetch magnets data
  const baseUrl = request.nextUrl.origin;
  let magnetsData: MagnetData[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/magnets`);
    if (res.ok) {
      magnetsData = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch magnets:', e);
  }

  // Decode the share state
  const placements = stateParam ? decodeShareState(stateParam) : [];

  // Build the SVG for magnets (ImageResponse uses Satori which works with React/SVG)
  const magnetElements = placements.map((placement, idx) => {
    const magnet = magnetsData[placement.magnetIndex];
    if (!magnet) return null;

    const { pixels, minX, minY, width, height } = parsePixels(magnet.pixels);

    // Calculate display size (similar to main app logic)
    const baseHeight = 60;
    const scaledHeight = baseHeight * placement.scale;
    const aspectRatio = width / height;
    const scaledWidth = scaledHeight * aspectRatio;

    // Scale factor from 256 canvas to our CANVAS_SIZE
    const canvasScale = CANVAS_SIZE / 256;

    // Position in OG image coordinates
    const displayX = CANVAS_OFFSET_X + (placement.x * canvasScale) - (scaledWidth * canvasScale / 2);
    const displayY = CANVAS_OFFSET_Y + (placement.y * canvasScale) - (scaledHeight * canvasScale / 2);
    const displayWidth = scaledWidth * canvasScale;
    const displayHeight = scaledHeight * canvasScale;

    // Render each pixel as a tiny rect
    const pixelSize = displayWidth / width;

    return (
      <div
        key={idx}
        style={{
          position: 'absolute',
          left: displayX,
          top: displayY,
          width: displayWidth,
          height: displayHeight,
          display: 'flex',
          flexWrap: 'wrap',
        }}
      >
        {pixels.map((p, pIdx) => (
          <div
            key={pIdx}
            style={{
              position: 'absolute',
              left: (p.x - minX) * pixelSize,
              top: (p.y - minY) * pixelSize,
              width: pixelSize + 0.5, // Slight overlap to avoid gaps
              height: pixelSize + 0.5,
              backgroundColor: palette[p.colorIndex] || '#49e7ec',
            }}
          />
        ))}
      </div>
    );
  }).filter(Boolean);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#18181b',
          position: 'relative',
        }}
      >
        {/* Fridge background */}
        <div
          style={{
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            backgroundColor: '#a1a1aa',
            borderRadius: 16,
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        />

        {/* Placed magnets */}
        {magnetElements}

        {/* Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 32,
            color: '#71717a',
            fontSize: 24,
            fontWeight: 600,
          }}
        >
          BasePaint Fridge
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
