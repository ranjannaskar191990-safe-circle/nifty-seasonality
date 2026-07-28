import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface StockData {
  Symbol: string;
  'Company Name': string;
}

async function analyzeStock(symbol: string, companyName: string) {
  try {
    const yfSymbol = `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}?range=15y&interval=1mo`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const quotes = result.indicators?.quote?.[0];
    if (!quotes || !quotes.high || !quotes.close || !quotes.volume) return null;

    const highs: number[] = quotes.high;
    const closes: number[] = quotes.close;
    const volumes: number[] = quotes.volume;

    // --- LOGIC: ATH ---
    let ath = 0;
    let athIndex = -1;
    for (let i = 0; i < highs.length - 2; i++) {
      if (highs[i] > ath) {
        ath = highs[i];
        athIndex = i;
      }
    }

    const monthsSinceATH = (highs.length - 2 - athIndex) + 1;
    if (monthsSinceATH < 60) return null;

    const cmp = closes[closes.length - 1];
    if (cmp < 50) return null;

    // Momentum & Trend
    const priceThreeMonthsAgo = closes[closes.length - 4];
    if (cmp < priceThreeMonthsAgo) return null;

    const last10Closes = closes.slice(-11, -1);
    const tenMonthSMA = last10Closes.reduce((a, b) => (a || 0) + (b || 0), 0) / 10;
    if (cmp < tenMonthSMA) return null;

    // --- VOLUME CALCULATION ---
    const validVolumes = volumes.filter((v) => v !== null);
    const last20Vols = validVolumes.slice(-21, -1);
    const avgVol = last20Vols.reduce((a, b) => a + b, 0) / (last20Vols.length || 1);
    const currentVol = validVolumes[validVolumes.length - 1] || 0;
    const volumeRatio = avgVol > 0 ? currentVol / avgVol : 0;

    const dist = ((cmp - ath) / ath) * 100;
    
    // Zone: 0% to -20%
    if (dist <= 0.0 && dist >= -20.0) {
      return { 
        symbol, 
        companyName, 
        cmp, 
        fiveYearHigh: ath, 
        distancePerc: dist,
        volumeRatio: parseFloat(volumeRatio.toFixed(1)),
        volume20SMA: BigInt(Math.floor(avgVol))
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log('🚀 Starting Daily Market Scan...');
  const nseRes = await fetch('https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv');
  const csvText = await nseRes.text();
  
  const parsed = Papa.parse<StockData>(csvText, { header: true });
  const stocks = parsed.data.filter((s) => s.Symbol);

  console.log(`Found ${stocks.length} stocks. Starting scan...`);

  await prisma.multiYearBreakout.deleteMany({});

  for (const stock of stocks) {
    const result = await analyzeStock(stock.Symbol, stock['Company Name']);
    if (result) {
      await prisma.multiYearBreakout.create({ data: result });
      console.log(`✅ Saved: ${stock.Symbol}`);
    }
    await sleep(250);
  }
  
  // Log the scan completion
  await prisma.scanLog.create({ data: { lastRun: new Date() } });
  
  console.log('✅ Scan Complete.');
  process.exit(0);
}

run().catch(console.error);