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

    const queryOptions: any = {
      period1: startDate,
      period2: endDate,
      interval: '1mo'
    };
    
    // Unwrap the module safely
    const yf = (yahooFinance as any).default || yahooFinance;
    
    // Fetch the 10-year data directly (Removed the suppressNotices line!)
    const yahooSymbol = `${symbol}.NS`;
    const result = await yf.historical(yahooSymbol, queryOptions);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || String(error) 
    }, { status: 500 });
  }
}