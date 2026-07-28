import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function analyzeStockForBreakout(symbol: string, companyName: string) {
  try {
    const yfSymbol = `${symbol}.NS`; 
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=15y&interval=1mo`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const quotes = result.indicators?.quote?.[0];
    if (!quotes || !quotes.high || !quotes.close || !quotes.volume) return null;

    const highs = quotes.high;
    const closes = quotes.close;
    const volumes = quotes.volume;

    let ath = 0;
    let athIndex = -1;
    const lastValidIndex = highs.length - 2; 

    for (let i = 0; i <= lastValidIndex; i++) {
      if (highs[i] !== null && highs[i] > ath) {
        ath = highs[i];
        athIndex = i;
      }
    }

    if (athIndex === -1) return null;

    const monthsSinceATH = (lastValidIndex - athIndex) + 1;
    if (monthsSinceATH < 60) return null;

    let cmp = 0;
    for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] !== null) {
            cmp = closes[i];
            break;
        }
    }

    if (cmp < 50) return null;

    const distancePerc = ((cmp - ath) / ath) * 100;

    if (distancePerc >= -5.0 && distancePerc <= 2.0) {
      const validVolumes = volumes.filter((v: number | null) => v !== null);
      const historicalVolumes = validVolumes.slice(0, validVolumes.length - 1);
      const last20Vols = historicalVolumes.slice(-20);
      
      const avgVol = last20Vols.reduce((a: number, b: number) => a + b, 0) / (last20Vols.length || 1);
      const currentVol = validVolumes[validVolumes.length - 1] || 0;
      const volumeRatio = avgVol > 0 ? (currentVol / avgVol) : 0;

      return {
        symbol,
        companyName,
        cmp: parseFloat(cmp.toFixed(2)),
        fiveYearHigh: parseFloat(ath.toFixed(2)), 
        distancePerc: parseFloat(distancePerc.toFixed(2)),
        volumeRatio: parseFloat(volumeRatio.toFixed(1)),
        volume20SMA: BigInt(Math.floor(avgVol)),
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { batch } = await request.json();
    const validSetups = [];
    
    // Process the batch concurrently
    const results = await Promise.all(
      batch.map((stock: any) => analyzeStockForBreakout(stock.symbol, stock.companyName))
    );

    for (const result of results) {
      if (result) validSetups.push(result);
    }

    // Save only the breakouts to the database
    for (const setup of validSetups) {
      await prisma.multiYearBreakout.create({ data: setup });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Batch processing failed' }, { status: 500 });
  }
}