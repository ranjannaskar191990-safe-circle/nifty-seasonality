import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET() {
  try {
    // 1. Wipe the old scan results from the database
    await prisma.multiYearBreakout.deleteMany({});

    // 2. Fetch Nifty Total Market (750 stocks)
    const nseUrl = "https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv";
    const nseRes = await fetch(nseUrl);
    const csvData = await nseRes.text();
    
    const parsedData = Papa.parse(csvData, { header: true });
    // @ts-ignore
    const stocks = parsedData.data
      .filter((row: any) => row.Symbol && row['Company Name'])
      .map((row: any) => ({ symbol: row.Symbol, companyName: row['Company Name'] }));

    return NextResponse.json({ success: true, stocks });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to initialize scan' }, { status: 500 });
  }
}