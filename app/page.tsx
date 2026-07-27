import { Pool } from 'pg';

// 1. Connect to your Neon cloud database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function Home() {
  // 2. Fetch the summary of your 10-year stock data
  const client = await pool.connect();
  let stockData = [];
  try {
    const res = await client.query(`
      SELECT symbol, COUNT(*) as total_days, MAX(trade_date) as latest_date 
      FROM daily_prices 
      GROUP BY symbol 
      ORDER BY symbol
    `);
    stockData = res.rows;
  } finally {
    client.release();
  }

  // 3. Display the Dashboard
  return (
    <main className="p-10 font-sans bg-gray-50 min-h-screen text-black">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Seasonality & Probability Portal</h1>
        <p className="text-gray-500 mb-8">Database connected successfully. 10-year historical baseline established.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="p-4 rounded-tl-lg font-semibold">Stock Symbol</th>
                <th className="p-4 font-semibold">Total Trading Days</th>
                <th className="p-4 rounded-tr-lg font-semibold">Latest Record</th>
              </tr>
            </thead>
            <tbody>
              {stockData.map((row) => (
                <tr key={row.symbol} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-blue-700">{row.symbol}</td>
                  <td className="p-4">{row.total_days} days logged</td>
                  <td className="p-4 text-gray-600">
                    {new Date(row.latest_date).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}