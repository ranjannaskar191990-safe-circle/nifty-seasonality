import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

// Helper to fetch and calculate breakout using Monthly Candlesticks
async function analyzeStockForBreakout(symbol: string, companyName: string) {
  try {
    // Append .NS to match Yahoo Finance format for Indian NSE stocks
    const yfSymbol = `${symbol}.NS`; 
    
    // Fetch 15 years of Monthly candlestick data
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

    // 1. Find the true All-Time High (ATH) over the 15 years and WHEN it happened
    let ath = 0;
    let athIndex = -1;
    
    // We ignore the very last candle (current active month) for finding historical resistance
    const lastValidIndex = highs.length - 2; 

    for (let i = 0; i <= lastValidIndex; i++) {
      if (highs[i] !== null && highs[i] > ath) {
        ath = highs[i];
        athIndex = i;
      }
    }

    if (athIndex === -1) return null;

    // 2. TRUE CONSOLIDATION RULE: Did this ATH happen at least 5 years (60 months) ago?
    const monthsSinceATH = (lastValidIndex - athIndex) + 1;
    if (monthsSinceATH < 60) {
        // The high was achieved too recently (e.g. 4 years ago). Ignore.
        return null;
    }

    // 3. Get Current Market Price (Latest valid close)
    let cmp = 0;
    for (let i = closes.length - 1; i >= 0; i--) {
        if (closes[i] !== null) {
            cmp = closes[i];
            break;
        }
    }

    // Price Filter: Ignore penny stocks below ₹50
    if (cmp < 50) return null;

    // 4. Calculate distance to the 15-Year resistance
    const distancePerc = ((cmp - ath) / ath) * 100;

    // BREAKOUT PROXIMITY RULE: 
    // Is it within 5% below the old resistance, or just broke out by max 2%?
    if (distancePerc >= -5.0 && distancePerc <= 2.0) {
      
      // Calculate Volume Expansion against 20-Month SMA
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
        fiveYearHigh: parseFloat(ath.toFixed(2)), // Storing the 15Y ATH here to match DB schema
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

export async function GET() {
  try {
    // 1. Fetch live Nifty 500 Stock Universe directly from NSE servers
    const nseUrl = "https://archives.nseindia.com/content/indices/ind_nifty500list.csv";
    const nseRes = await fetch(nseUrl);
    const csvData = await nseRes.text();
    
    const parsedData = Papa.parse(csvData, { header: true });
    // @ts-ignore
    let stocksToScan = parsedData.data.filter((row: any) => row.Symbol && row['Company Name']);
    
    // API LIMIT PRESERVER: Capping at top 150 stocks to prevent 15-second server timeout.
    stocksToScan = stocksToScan.slice(0, 150);

    const validSetups = [];

    // 2. Process in concurrent batches to maximize speed without tripping rate limits
    const CHUNK_SIZE = 15;
    for (let i = 0; i < stocksToScan.length; i += CHUNK_SIZE) {
      const chunk = stocksToScan.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        // @ts-ignore
        chunk.map(stock => analyzeStockForBreakout(stock.Symbol, stock['Company Name']))
      );
      
      for (const result of results) {
        if (result) validSetups.push(result);
      }
    }

    // 3. Clear old data and push the true calculations to your Neon DB
    await prisma.multiYearBreakout.deleteMany({});
    
    for (const setup of validSetups) {
      await prisma.multiYearBreakout.create({ data: setup });
    }

    return NextResponse.json({ 
      success: true, 
      scannedCount: stocksToScan.length,
      breakoutsFound: validSetups.length,
      message: '15-Year Base Scan complete and database updated.' 
    });
    
  } catch (error) {
    console.error('Scanner error:', error);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}