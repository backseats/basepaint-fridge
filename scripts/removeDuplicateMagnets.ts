import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAGNETS_FILE = join(process.cwd(), 'magnets.json');

const data = readFileSync(MAGNETS_FILE, 'utf-8');
const magnets = JSON.parse(data);

console.log(`Total magnets: ${magnets.length}`);

// Remove duplicates based on transactionHash, keeping the first occurrence
const seen = new Set();
const uniqueMagnets = magnets.filter((magnet: any) => {
  if (seen.has(magnet.transactionHash)) {
    return false;
  }
  seen.add(magnet.transactionHash);
  return true;
});

console.log(`Unique magnets: ${uniqueMagnets.length}`);
console.log(`Removed duplicates: ${magnets.length - uniqueMagnets.length}`);

// Write back to file
writeFileSync(MAGNETS_FILE, JSON.stringify(uniqueMagnets, null, 2));

console.log('Done! magnets.json has been updated.');
