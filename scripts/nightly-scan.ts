import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runNightlyScan() {
  console.log("🌙 Starting Full NSE Market Breakout Scan...");

  // 1. Wipe yesterday's data
  await prisma.potentialBreakout.deleteMany({});
  console.log("🧹 Cleared old data.");

  // 2. Fetch the FULL NSE Equity List (Disguised as a real browser)
  const nseRes = await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/csv'
    }
  });
  const csvText = await nseRes.text();
  
  // Parse the CSV & clean up NSE's messy column headers
  const parsed = Papa.parse<any>(csvText, { 
    header: true, 
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });
  
  // 3. Filter for standard Equities only (ignore ETFs, bonds, SME stocks, etc.)
  const stocks = parsed.data.filter((s: any) => s.SYMBOL && s.SERIES === 'EQ');

  console.log(`📊 Found ${stocks.length} pure equity stocks. Starting scan...`);

  // 4. Analyze each stock
  for (const stock of stocks) {
    try {
      const symbol = stock.SYMBOL;
      const companyName = stock['NAME OF COMPANY'];
      
      // Using 15y range to ensure we can see historical bases older than 3 years
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?range=15y&interval=1mo`;
      const res = await fetch(url);
      
      if (!res.ok) continue;

      const data = await res.json();
      const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
      if (!quotes || !quotes.high || !quotes.close) continue;

      const highs: number[] = quotes.high.filter((h: number | null) => h !== null);
      const closes: number[] = quotes.close.filter((c: number | null) => c !== null);
      
      if (highs.length < 50 || closes.length < 50) continue;

      // --- EXPERT LOGIC: Find ATH and When It Happened ---
      let ath = 0;
      let athIndex = -1;
      
      // Look for the highest high, excluding the most recent 2 months
      for (let i = 0; i < highs.length - 2; i++) {
        if (highs[i] > ath) {
          ath = highs[i];
          athIndex = i;
        }
      }

      // Calculate how many months ago the ATH was set
      const monthsSinceATH = (highs.length - 2 - athIndex) + 1;
      
      // Reject if the ATH was made recently (Must be at least 36 months / 3 years old)
      if (monthsSinceATH < 36) continue; 

      const currentPrice = closes[closes.length - 1];
      const distanceFromHigh = ((currentPrice - ath) / ath) * 100;

      // Logic: Stock must be above 50 Rs, and within -20% to 0% of its All-Time High
      if (currentPrice >= 50 && distanceFromHigh >= -20.0 && distanceFromHigh <= 0.0) {
        
        // Save to Database
        await prisma.potentialBreakout.create({
          data: {
            symbol: symbol,
            companyName: companyName,
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            distanceFromHigh: parseFloat(distanceFromHigh.toFixed(2)),
            baseLengthMonths: monthsSinceATH, // Saving the base length
          }
        });
        console.log(`✅ Found Breakout Setup: ${symbol} (Base: ${monthsSinceATH} months)`);
      }
    } catch (error) {
      // Ignore errors for individual stocks to keep the loop running
    }
    
    // Pause for 500ms so Yahoo doesn't block the server for scanning 2000+ stocks
    await sleep(500); 
  }

  console.log("🏁 Full Market Nightly Scan Complete!");
  process.exit(0);
}

runNightlyScan();