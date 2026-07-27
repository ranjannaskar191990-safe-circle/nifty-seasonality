import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET: Load your saved stocks when you open the dashboard
export async function GET() {
  try {
    const savedPortfolio = await prisma.portfolio.findMany({
      where: { userId: "admin" } // Hardcoded admin profile for you
    });
    return NextResponse.json(savedPortfolio);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

// POST: Save or remove a stock when you click the button
export async function POST(req: Request) {
  try {
    const { symbol, targetMonth, requiredCapital, action } = await req.json();

    if (action === "add") {
      await prisma.portfolio.create({
        data: { userId: "admin", symbol, targetMonth, requiredCapital }
      });
    } else if (action === "remove") {
      await prisma.portfolio.deleteMany({
        where: { userId: "admin", symbol, targetMonth }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update database" }, { status: 500 });
  }
}