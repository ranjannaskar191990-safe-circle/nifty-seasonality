import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET: Load all your past trade journal entries
export async function GET() {
  try {
    const journalEntries = await prisma.tradeJournal.findMany({
      where: { userId: "admin" },
      orderBy: { createdAt: 'desc' } // Shows newest trades first
    });
    return NextResponse.json(journalEntries);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load journal" }, { status: 500 });
  }
}

// POST: Add a new trade execution record
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const newEntry = await prisma.tradeJournal.create({
      data: {
        userId: "admin",
        symbol: body.symbol,
        tradeMonth: body.tradeMonth,
        noTradeGapMet: body.noTradeGapMet,
        gttStopPlaced: body.gttStopPlaced,
        earningsCleared: body.earningsCleared,
        entryDate: new Date(body.entryDate),
        entryPrice: parseFloat(body.entryPrice),
        exitDate: body.exitDate ? new Date(body.exitDate) : null,
        exitPrice: body.exitPrice ? parseFloat(body.exitPrice) : null,
        allocatedAmount: parseFloat(body.allocatedAmount),
        netPnL: body.netPnL ? parseFloat(body.netPnL) : null,
        notes: body.notes || ""
      }
    });

    return NextResponse.json({ success: true, entry: newEntry });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save journal entry" }, { status: 500 });
  }
}