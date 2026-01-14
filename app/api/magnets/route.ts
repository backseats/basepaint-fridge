import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAGNETS_FILE = join(process.cwd(), 'magnets.json');

export async function GET() {
  try {
    const data = readFileSync(MAGNETS_FILE, 'utf-8');
    const magnets = JSON.parse(data);
    return NextResponse.json(magnets);
  } catch (error) {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const newMagnet = await request.json();

    // Read existing magnets
    let magnets = [];
    try {
      const data = readFileSync(MAGNETS_FILE, 'utf-8');
      magnets = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is empty, start with empty array
    }

    // Check for duplicate based on transactionHash
    const isDuplicate = magnets.some(
      (magnet: any) => magnet.transactionHash === newMagnet.transactionHash
    );

    if (isDuplicate) {
      return NextResponse.json({ success: false, error: 'Magnet already saved' }, { status: 400 });
    }

    // Add new magnet
    magnets.push(newMagnet);

    // Write back to file
    writeFileSync(MAGNETS_FILE, JSON.stringify(magnets, null, 2));

    return NextResponse.json({ success: true, magnet: newMagnet });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to save magnet' }, { status: 500 });
  }
}
