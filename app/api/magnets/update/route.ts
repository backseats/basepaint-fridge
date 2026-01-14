import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const MAGNETS_FILE = join(process.cwd(), 'magnets.json');

export async function POST(request: Request) {
  try {
    const { transactionHash, pixels } = await request.json();

    if (!transactionHash || typeof pixels !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // Read existing magnets
    let magnets = [];
    try {
      const data = readFileSync(MAGNETS_FILE, 'utf-8');
      magnets = JSON.parse(data);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to read magnets' },
        { status: 500 }
      );
    }

    // Find and update the magnet
    const magnetIndex = magnets.findIndex(
      (m: any) => m.transactionHash === transactionHash
    );

    if (magnetIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Magnet not found' },
        { status: 404 }
      );
    }

    // Update the pixels
    magnets[magnetIndex] = {
      ...magnets[magnetIndex],
      pixels: pixels,
    };

    // Write back to file
    writeFileSync(MAGNETS_FILE, JSON.stringify(magnets, null, 2));

    return NextResponse.json({ success: true, magnet: magnets[magnetIndex] });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update magnet' },
      { status: 500 }
    );
  }
}
