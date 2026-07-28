import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runNightlyScan() {
  console.log("🌙 Starting Nightly Breakout Scan...");

  // 1. Wipe yesterday's data
  await prisma.potentialBreakout.deleteMany({});
  console.log("🧹 Cleared old data.");

  // 2. Fetch all Nifty Total Market stocks
  const nseRes = await fetch('https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv');
  const csvText = await nseRes.text();
  const parsed = Papa.parse<{ Symbol: string; 'Company Name': string }>(csvText, { header: true });
  const stocks = parsed.data.filter(s => s.Symbol);

  // 3. Analyze each stock
  for (const stock of stocks) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${stock.Symbol}.NS?range=5y&interval=1mo`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!quotes || !quotes.high || !quotes.close) continue;

      const highs: number[] = quotes.high.filter((h: number | null) => h !== null);
      const closes: number[] = quotes.close.filter((c: number | null) => c !== null);
      
      if (highs.length < 50 || closes.length < 50) continue;

      const ath = Math.max(...highs);
      const currentPrice = closes[closes.length - 1];
      const distanceFromHigh = ((currentPrice - ath) / ath) * 100;

      // YOUR LOGIC: Stock must be above 50 Rs, and within -20% to 0% of its All-Time High
      if (currentPrice >= 50 && distanceFromHigh >= -20.0 && distanceFromHigh <= 0.0) {
        
        // Save to Database!
        await prisma.potentialBreakout.create({
          data: {
            symbol: stock.Symbol,
            companyName: stock['Company Name'],
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            distanceFromHigh: parseFloat(distanceFromHigh.toFixed(2)),
          }
        });
        console.log(`✅ Found Breakout Setup: ${stock.Symbol}`);
      }
    } catch (error) {
      // Ignore errors for individual stocks to keep the loop running
    }
    
    // Pause for 200ms so Yahoo doesn't block us
    await sleep(200); 
  }

  console.log("🏁 Nightly Scan Complete!");
  process.exit(0);
}

runNightlyScan();