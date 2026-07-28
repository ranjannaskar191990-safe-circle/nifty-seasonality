import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure this points to your instantiated PrismaClient

export async function GET() {
  try {
    // Note: Replace mockScannedStocks with your actual NSE API fetching logic.
    // Ensure your real logic calculates the 5Y high and filters CMP >= 50.
    const mockScannedStocks = [
      {
        symbol: 'TRENT',
        companyName: 'Trent Limited',
        cmp: 2938.30,
        fiveYearHigh: 3000.00,
        distancePerc: -2.06,
        volumeRatio: 2.4,
        volume20SMA: 1500000n,
      },
      {
        symbol: 'BEL',
        companyName: 'Bharat Electronics Ltd.',
        cmp: 234.50,
        fiveYearHigh: 240.00,
        distancePerc: -2.29,
        volumeRatio: 1.8,
        volume20SMA: 5000000n,
      }
    ];

    // Clear yesterday's scan results to keep the DB lightweight
    await prisma.multiYearBreakout.deleteMany({});

    // Write today's qualifying stocks to Neon DB (applying the > ₹50 rule)
    for (const stock of mockScannedStocks) {
      if (stock.cmp >= 50) { 
        await prisma.multiYearBreakout.create({
          data: {
            symbol: stock.symbol,
            companyName: stock.companyName,
            cmp: stock.cmp,
            fiveYearHigh: stock.fiveYearHigh,
            distancePerc: stock.distancePerc,
            volumeRatio: stock.volumeRatio,
            volume20SMA: stock.volume20SMA,
          }
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Scan complete and database updated.' });
  } catch (error) {
    console.error('Scanner error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}