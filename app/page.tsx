import { Pool } from 'pg';

// 1. Connect to your Neon cloud database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function Home() {
  const client = await pool.connect();
  let dashboardData = [];

  try {
    // 2. Calculate Historical August Win Rate (Green Days)
    const augRes = await client.query(`
      SELECT 
        symbol,
        ROUND((COUNT(CASE WHEN close_price > open_price THEN 1 END) * 100.0) / COUNT(*), 1) as august_win_rate
      FROM daily_prices 
      WHERE EXTRACT(MONTH FROM trade_date) = 8
      GROUP BY symbol
    `);
    
    // 3. Find the Most Profitable Day of the Week
    const dowRes = await client.query(`
      WITH DayStats AS (
        SELECT 
          symbol,
          EXTRACT(ISODOW FROM trade_date) as dow,
          AVG((close_price - open_price) / NULLIF(open_price, 0) * 100) as avg_return
        FROM daily_prices
        GROUP BY symbol, EXTRACT(ISODOW FROM trade_date)
      ),
      RankedDays AS (
        SELECT 
          symbol, 
          dow, 
          avg_return,
          ROW_NUMBER() OVER(PARTITION BY symbol ORDER BY avg_return DESC) as rank
        FROM DayStats
      )
      SELECT symbol, dow, ROUND(avg_return::numeric, 3) as best_return
      FROM RankedDays
      WHERE rank = 1
    `);

    // Helper to map PostgreSQL day numbers to names
    const dayNames: { [key: number]: string } = {
      1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday'
    };

    // 4. Merge the data together
    dashboardData = augRes.rows.map(aug => {
      const dow = dowRes.rows.find(d => d.symbol === aug.symbol);
      return {
        symbol: aug.symbol,
        augustWinRate: aug.august_win_rate,
        bestDay: dow ? dayNames[dow.dow as number] : 'N/A',
        bestReturn: dow ? dow.best_return : 0
      };
    }).sort((a, b) => b.augustWinRate - a.augustWinRate); // Sort highest probability first

  } finally {
    client.release();
  }

  // 5. Display the modern UI Cards
  return (
    <main className="p-4 md:p-10 font-sans bg-slate-50 min-h-screen text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">August Seasonality Matrix</h1>
          <p className="text-slate-500 mt-2">10-year historical probability models for Nifty 50 heavyweights.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardData.map((stock) => (
            <div key={stock.symbol} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-800">{stock.symbol}</h2>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  stock.augustWinRate >= 53 ? 'bg-green-100 text-green-700' : 
                  stock.augustWinRate <= 47 ? 'bg-red-100 text-red-700' : 
                  'bg-slate-100 text-slate-700'
                }`}>
                  {stock.augustWinRate}% Win Rate
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Historical August Edge</p>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${stock.augustWinRate >= 53 ? 'bg-green-500' : stock.augustWinRate <= 47 ? 'bg-red-500' : 'bg-slate-400'}`} 
                      style={{ width: `${stock.augustWinRate}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Strongest Trading Day</p>
                  <p className="text-slate-700 mt-1 text-lg">
                    <span className="font-semibold">{stock.bestDay}</span> 
                    <span className="text-green-600 text-sm ml-2 font-medium">(+{stock.bestReturn}% avg)</span>
                  </p>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </main>
  );
}