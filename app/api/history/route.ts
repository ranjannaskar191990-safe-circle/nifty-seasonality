import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol'); 

  if (!symbol) {
    return NextResponse.json({ error: "Stock symbol is required" }, { status: 400 });
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 10);

    const queryOptions = {
      period1: startDate,
      period2: endDate,
      interval: '1mo'
    };
    
    // Nifty stocks on Yahoo Finance require the .NS extension
    const yahooSymbol = `${symbol}.NS`;
    const result = await yahooFinance.historical(yahooSymbol, queryOptions);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch historical data" }, { status: 500 });
  }
}