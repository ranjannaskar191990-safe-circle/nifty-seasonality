import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runNightlyScan() {
  console.log("🌙 Starting Full NSE Market Breakout Scan...");

  let stocks: any[] = [];

  // 1. Try fetching full NSE Equity List
  try {
    const nseRes = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/csv'
      }
    });
    
    if (nseRes.ok) {
      const csvText = await nseRes.text();
      const parsed = Papa.parse<any>(csvText, { 
        header: true, 
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });
      stocks = parsed.data.filter((s: any) => s.SYMBOL && s.SERIES === 'EQ');
    }
  } catch (err) {
    console.log("⚠️ Could not fetch NSE CSV, using fallback method...");
  }

  // Fallback: If NSE blocks CSV fetch, use Nifty Total Market URL
  if (stocks.length === 0) {
    try {
      const nseRes = await fetch('https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv');
      const csvText = await nseRes.text();
      const parsed = Papa.parse<any>(csvText, { header: true, skipEmptyLines: true });
      stocks = parsed.data
        .filter((s: any) => s.Symbol)
        .map((s: any) => ({ SYMBOL: s.Symbol, 'NAME OF COMPANY': s['Company Name'] }));
    } catch (e) {
      console.error("❌ Failed to load stock list.");
      process.exit(1);
    }
  }

  console.log(`📊 Scanning ${stocks.length} stocks...`);

  const resultsToSave: Array<{
    symbol: string;
    companyName: string;
    currentPrice: number;
    distanceFromHigh: number;
    baseLengthMonths: number;
  }> = [];

  // 2. Analyze each stock
  for (const stock of stocks) {
    try {
      const symbol = stock.SYMBOL;
      const companyName = stock['NAME OF COMPANY'] || symbol;
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?range=15y&interval=1mo`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!quotes || !quotes.high || !quotes.close) continue;

      const highs: number[] = quotes.high.filter((h: number | null) => h !== null);
      const closes: number[] = quotes.close.filter((c: number | null) => c !== null);
      
      if (highs.length < 24 || closes.length < 24) continue;

      // Find highest high excluding the last 2 months
      let ath = 0;
      let athIndex = -1;
      
      for (let i = 0; i < highs.length - 2; i++) {
        if (highs[i] > ath) {
          ath = highs[i];
          athIndex = i;
        }
      }

      if (ath <= 0 || athIndex === -1) continue;

      // Calculate base length in months
      const monthsSinceATH = (highs.length - 2 - athIndex) + 1;
      
      // Base must be at least 12 months (1 year) old
      if (monthsSinceATH < 12) continue; 

      const currentPrice = closes[closes.length - 1];
      const distanceFromHigh = ((currentPrice - ath) / ath) * 100;

      // Criteria: Price >= 50, and within -20% to 0% of its base high
      if (currentPrice >= 50 && distanceFromHigh >= -20.0 && distanceFromHigh <= 0.0) {
        resultsToSave.push({
          symbol,
          companyName,
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          distanceFromHigh: parseFloat(distanceFromHigh.toFixed(2)),
          baseLengthMonths: monthsSinceATH,
        });
        console.log(`✅ Found Setup: ${symbol} (${monthsSinceATH} Month Base)`);
      }
    } catch (error) {
      // Ignore individual stock errors
    }
    
    await sleep(200); 
  }

  // 3. Update Database ONLY when scan finishes successfully
  if (resultsToSave.length > 0) {
    await prisma.potentialBreakout.deleteMany({});
    await prisma.potentialBreakout.createMany({
      data: resultsToSave
    });
    console.log(`💾 Saved ${resultsToSave.length} breakout setups to database.`);
  } else {
    console.log("⚠️ Scan finished with 0 results. Preserved existing database records.");
  }

  console.log("🏁 Scan Complete!");
  process.exit(0);
}

runNightlyScan();