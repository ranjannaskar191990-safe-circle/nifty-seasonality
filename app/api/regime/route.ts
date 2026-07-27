import { NextResponse } from 'next/server';

// Helper function to fetch and calculate DMA for any index
async function fetchIndexData(ticker: string, startTimestamp: number, endTimestamp: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  
  if (!response.ok) throw new Error(`Failed to fetch ${ticker}`);
  
  const data = await response.json();
  const quotes = data.chart.result[0].indicators.quote[0];
  const closes = quotes.close.filter((c: any) => c !== null).slice(-200);
  
  const currentClose = closes[closes.length - 1];
  const sum200 = closes.reduce((a: number, b: number) => a + b, 0);
  const dma200 = sum200 / closes.length;
  
  return {
    current: parseFloat(currentClose.toFixed(2)),
    dma200: parseFloat(dma200.toFixed(2)),
    isHealthy: currentClose > dma200
  };
}

export async function GET() {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 300); 
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // Fetch both Nifty 50 (^NSEI) and Nifty 200 (^CNX200) simultaneously
    const [nifty50, nifty200] = await Promise.all([
      fetchIndexData('^NSEI', startTimestamp, endDate),
      fetchIndexData('^CNX200', startTimestamp, endDate)
    ]);
    
    return NextResponse.json({
      nifty50,
      nifty200,
      // BOTH must be healthy to declare a Bull Regime
      isBullRegime: nifty50.isHealthy && nifty200.isHealthy 
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch market regime" }, { status: 500 });
  }
}