import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetching from our NEW table, sorted by closest to breakout
    const data = await prisma.potentialBreakout.findMany({
      orderBy: { distanceFromHigh: 'desc' }
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Database fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch breakouts" }, { status: 500 });
  }
}