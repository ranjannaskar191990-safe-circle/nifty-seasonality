import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const url = "https://nsearchives.nseindia.com/content/indices/ind_nifty200list.csv";
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch CSV from NSE" }, { status: 500 });
    }

    const csvData = await response.text();
    return new NextResponse(csvData, {
      headers: { 'Content-Type': 'text/csv' },
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error fetching data" }, { status: 500 });
  }
}