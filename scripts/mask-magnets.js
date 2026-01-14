const fs = require('fs');
const path = require('path');

// Load the painted events
const paintedEvents = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/painted-events-day-886.json'), 'utf-8')
);

// Load the magnets
const magnets = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../magnets.json'), 'utf-8')
);

// Create a map of all pixels from the painted events (final state)
const pixelMap = new Map(); // key: "x,y", value: colorIndex

// Process all painted events to build final canvas state
paintedEvents.forEach((event) => {
  const hexString = event.pixels;

  for (let i = 0; i < hexString.length; i += 6) {
    const xHex = hexString.slice(i, i + 2);
    const yHex = hexString.slice(i + 2, i + 4);
    const colorHex = hexString.slice(i + 4, i + 6);

    const x = parseInt(xHex, 16);
    const y = parseInt(yHex, 16);
    const colorIndex = parseInt(colorHex, 16);

    pixelMap.set(`${x},${y}`, colorIndex);
  }
});

console.log(`Total pixels in final canvas: ${pixelMap.size}`);

// Create a set of all magnet pixels
const magnetPixels = new Set();

magnets.forEach((magnet) => {
  const hexString = magnet.pixels;

  for (let i = 0; i < hexString.length; i += 6) {
    const xHex = hexString.slice(i, i + 2);
    const yHex = hexString.slice(i + 2, i + 4);

    const x = parseInt(xHex, 16);
    const y = parseInt(yHex, 16);

    magnetPixels.add(`${x},${y}`);
  }
});

console.log(`Total magnet pixels: ${magnetPixels.size}`);

// Replace all magnet pixels with cyan (color index 0)
let replacedCount = 0;
magnetPixels.forEach((coordKey) => {
  if (pixelMap.has(coordKey)) {
    pixelMap.set(coordKey, 0); // Color index 0 = #49e7ec (cyan)
    replacedCount++;
  }
});

console.log(`Replaced ${replacedCount} pixels with cyan`);

// Convert the pixel map back to hex string
let newPixelString = '';
const sortedCoords = Array.from(pixelMap.keys()).sort((a, b) => {
  const [ax, ay] = a.split(',').map(Number);
  const [bx, by] = b.split(',').map(Number);
  if (ay !== by) return ay - by;
  return ax - bx;
});

sortedCoords.forEach((coordKey) => {
  const [x, y] = coordKey.split(',').map(Number);
  const colorIndex = pixelMap.get(coordKey);

  const xHex = x.toString(16).padStart(2, '0');
  const yHex = y.toString(16).padStart(2, '0');
  const colorHex = colorIndex.toString(16).padStart(2, '0');

  newPixelString += xHex + yHex + colorHex;
});

console.log(`New pixel string length: ${newPixelString.length} characters`);
console.log(`That's ${newPixelString.length / 6} pixels`);

// Save the new canvas data
const outputData = {
  description: "Canvas from painted-events-day-886.json with all magnet pixels replaced with cyan (#49e7ec)",
  pixels: newPixelString,
  totalPixels: pixelMap.size,
  magnetPixelsReplaced: replacedCount
};

fs.writeFileSync(
  path.join(__dirname, '../public/masked-canvas.json'),
  JSON.stringify(outputData, null, 2)
);

console.log('\nSaved to public/masked-canvas.json');
