import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol'); 
  if (!symbol) return NextResponse.json({ error: "Required" }, { status: 400 });

  try {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 400); // Fetch ~1.2 years to guarantee 52 weeks
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const yahooSymbol = `${symbol}.NS`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startTimestamp}&period2=${endDate}&interval=1wk`;

    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    const history = timestamps
      .map((time: number, index: number) => ({
        date: new Date(time * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        close: quotes.close[index]
      }))
      .filter((item: any) => item.close !== null)
      .slice(-52); // Keep exactly 52 weeks
    
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}