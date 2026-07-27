import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol'); 

  if (!symbol) {
    return NextResponse.json({ error: "Stock symbol is required" }, { status: 400 });
  }

  try {
    // Calculate exact Unix timestamps for Yahoo's native API
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 10);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const yahooSymbol = `${symbol}.NS`;
    
    // Direct call to Yahoo's chart API for monthly data
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startTimestamp}&period2=${endDate}&interval=1mo`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo API returned status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the raw data from Yahoo's specific JSON structure
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    // Map it into the clean { date, open, close } format your frontend expects
    const history = timestamps
      .map((time: number, index: number) => ({
        date: new Date(time * 1000).toISOString(),
        open: quotes.open[index],
        close: quotes.close[index]
      }))
      // Filter out any blank months where a stock didn't trade
      .filter((item: any) => item.open !== null && item.close !== null);
    
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || "Failed to fetch from Yahoo Finance API" 
    }, { status: 500 });
  }
}