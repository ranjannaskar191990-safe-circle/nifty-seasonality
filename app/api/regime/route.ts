import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = new Date();
    // Fetch roughly 300 calendar days to guarantee we get 200 actual trading days
    startDate.setDate(startDate.getDate() - 300); 
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // ^NSEI is the Yahoo Finance ticker for the Nifty 50 Index
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?period1=${startTimestamp}&period2=${endDate}&interval=1d`;
    
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    const quotes = data.chart.result[0].indicators.quote[0];
    const closes = quotes.close.filter((c: any) => c !== null).slice(-200);
    
    const currentClose = closes[closes.length - 1];
    const sum200 = closes.reduce((a: number, b: number) => a + b, 0);
    const dma200 = sum200 / closes.length;
    
    return NextResponse.json({
      current: parseFloat(currentClose.toFixed(2)),
      dma200: parseFloat(dma200.toFixed(2)),
      isBullRegime: currentClose > dma200
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch market regime" }, { status: 500 });
  }
}