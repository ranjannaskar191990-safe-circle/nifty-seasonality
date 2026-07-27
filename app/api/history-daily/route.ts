import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol'); 

  if (!symbol) {
    return NextResponse.json({ error: "Stock symbol is required" }, { status: 400 });
  }

  try {
    // Fetch roughly 45 calendar days to guarantee we get 30 actual trading days
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 45); 
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const yahooSymbol = `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startTimestamp}&period2=${endDate}&interval=1d`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) throw new Error("Yahoo API error");

    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const history = timestamps
      .map((time: number, index: number) => {
        const open = quotes.open[index];
        const close = quotes.close[index];
        const high = quotes.high[index];
        const low = quotes.low[index];

        return {
          date: new Date(time * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          open, close, high, low,
          // Recharts Floating Bar requires an array of [bottom, top]
          body: [Math.min(open, close), Math.max(open, close)],
          isUp: close >= open
        };
      })
      .filter((item: any) => item.open !== null && item.close !== null)
      .slice(-30); // Force strictly the last 30 trading days
    
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch daily data" }, { status: 500 });
  }
}