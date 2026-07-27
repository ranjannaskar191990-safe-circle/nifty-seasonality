import { NextResponse } from 'next/server';

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
    
    // THE SLEDGEHAMMER FIX: 
    // Dynamically import the module at runtime to completely bypass 
    // Next.js/Turbopack's bundling confusion.
    const yfModule = await import('yahoo-finance2');
    const yf = yfModule.default || yfModule;
    
    const yahooSymbol = `${symbol}.NS`;
    const result = await yf.historical(yahooSymbol, queryOptions);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || String(error) 
    }, { status: 500 });
  }
}