import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Next.js will fetch this instantly because the data is already sitting in the database
export default async function BreakoutDashboard() {
  const breakouts = await prisma.potentialBreakout.findMany({
    orderBy: { distanceFromHigh: 'desc' }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Potential Breakouts</h1>
      <p className="text-gray-500 mb-8">Data updated automatically last night.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {breakouts.map((stock) => (
          <div key={stock.id} className="border p-5 rounded-xl shadow-sm bg-white">
            <h2 className="text-xl font-bold text-blue-600">{stock.symbol}</h2>
            <p className="text-sm text-gray-600 truncate">{stock.companyName}</p>
            <div className="mt-4 pt-4 border-t flex justify-between">
              <span className="font-medium">₹{stock.currentPrice}</span>
              <span className={stock.distanceFromHigh >= -5 ? "text-green-600 font-bold" : "text-orange-500"}>
                {stock.distanceFromHigh}% from High
              </span>
            </div>
          </div>
        ))}
      </div>

      {breakouts.length === 0 && (
        <p className="text-center text-gray-500">No stocks in the breakout zone right now.</p>
      )}
    </div>
  );
}