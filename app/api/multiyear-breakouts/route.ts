import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const breakouts = await prisma.multiYearBreakout.findMany({
      orderBy: {
        distancePerc: 'desc' // Sorts so the stocks closest to the breakout appear first
      }
    });

    // BigInt cannot be serialized to JSON automatically, so it must be converted to a string
    const serializedBreakouts = breakouts.map(stock => ({
      ...stock,
      volume20SMA: stock.volume20SMA.toString()
    }));

    return NextResponse.json(serializedBreakouts);
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch breakouts from database' }, { status: 500 });
  }
}