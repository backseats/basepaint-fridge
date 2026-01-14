const { readFileSync, writeFileSync } = require('fs');
const magnets = JSON.parse(readFileSync('magnets.json', 'utf-8'));

// Find all three parts
const part1 = magnets.find(m => m.tokenId === '1339-part1');
const part2 = magnets.find(m => m.tokenId === '1339-part2');
const part3 = magnets.find(m => m.tokenId === '1339-part3');

if (!part1 || !part2 || !part3) {
  console.log('Error: Not all parts found');
  console.log('Part1:', !!part1, 'Part2:', !!part2, 'Part3:', !!part3);
  process.exit(1);
}

console.log('Found all three parts');
console.log('Part 1 pixels:', part1.pixels.length / 6);
console.log('Part 2 pixels:', part2.pixels.length / 6);
console.log('Part 3 pixels:', part3.pixels.length / 6);

// Combine pixels
const combinedPixels = part1.pixels + part2.pixels + part3.pixels;

// Create combined magnet (using part1 as base, removing -part1 suffix from transaction hash)
const originalTxHash = part1.transactionHash.replace('-part1', '');
const combinedMagnet = {
  ...part1,
  tokenId: '1339',
  transactionHash: originalTxHash,
  pixels: combinedPixels
};

console.log('Combined pixels:', combinedPixels.length / 6);

// Remove the three parts and add combined
const filtered = magnets.filter(m =>
  m.tokenId !== '1339-part1' &&
  m.tokenId !== '1339-part2' &&
  m.tokenId !== '1339-part3'
);

filtered.push(combinedMagnet);

console.log('Before:', magnets.length);
console.log('After:', filtered.length);

writeFileSync('magnets.json', JSON.stringify(filtered, null, 2));

console.log('Done! Token 1339 reassembled');
