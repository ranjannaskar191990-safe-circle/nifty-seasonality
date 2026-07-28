import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();

async function analyzeStockForBreakout(symbol: string, companyName: string) {
  try {
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

    let ath = 0;
    let athIndex = -1;
    
    // Ignore the current active month for historical resistance
    const lastValidIndex = highs.length - 2; 

    for (let i = 0; i <= lastValidIndex; i++) {
      if (highs[i] !== null && highs[i] > ath) {
        ath = highs[i];
        athIndex = i;
      }
    }

    if (athIndex === -1) return null;

    // TRUE CONSOLIDATION RULE: Did this ATH happen at least 5 years (60 months) ago?
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

    // PROXIMITY RULE: Is it within 5% below the old resistance, or broke out by max 2%?
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

async function runFullMarketScan() {
  console.log("🚀 Starting Full Market 15-Year Base Scan...");
  console.log("Fetching Nifty Total Market universe from NSE...");

  try {
    // Using the Nifty Total Market (750 stocks across all caps)
    const nseUrl = "https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv";
    const nseRes = await fetch(nseUrl);
    const csvData = await nseRes.text();
    
    const parsedData = Papa.parse(csvData, { header: true });
    
    // @ts-ignore
    const stocksToScan = parsedData.data.filter((row: any) => row.Symbol && row['Company Name']);
    
    console.log(`📊 Found ${stocksToScan.length} stocks. Beginning deep scan... This will take a few minutes.`);

    const validSetups = [];
    const CHUNK_SIZE = 15; // Process 15 at a time to avoid getting blocked by Yahoo Finance

    for (let i = 0; i < stocksToScan.length; i += CHUNK_SIZE) {
      const chunk = stocksToScan.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        // @ts-ignore
        chunk.map(stock => analyzeStockForBreakout(stock.Symbol, stock['Company Name']))
      );
      
      for (const result of results) {
        if (result) validSetups.push(result);
      }
      
      // Console logging progress so you know it isn't frozen
      process.stdout.write(`\r✅ Scanned ${Math.min(i + CHUNK_SIZE, stocksToScan.length)} / ${stocksToScan.length} stocks...`);
    }

    console.log(`\n\n🎯 Scan Complete! Found ${validSetups.length} valid 15-Year Breakout setups.`);
    console.log("💾 Wiping old data and saving to Neon Database...");

    await prisma.multiYearBreakout.deleteMany({});
    
    for (const setup of validSetups) {
      await prisma.multiYearBreakout.create({ data: setup });
    }

    console.log("✅ Database updated successfully! You can now check your web dashboard.");
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Fatal Scanner Error:', error);
    process.exit(1);
  }
}

runFullMarketScan();