'use client';
import { useEffect, useState } from 'react';

interface BreakoutStock {
  symbol: string;
  companyName: string;
  cmp: number;
  fiveYearHigh: number;
  distancePerc: number;
  volumeRatio: number;
  volume20SMA: string;
  lastScannedAt: string;
}

export default function MultiYearBO() {
  const [stocks, setStocks] = useState<BreakoutStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/multiyear-breakouts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch data');
        return res.json();
      })
      .then((data) => {
        setStocks(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 font-medium">Loading Setups from Neon Database...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-500 bg-red-50 rounded-md border border-red-200">Error: {error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-Year Breakout Scanner</h2>
          <p className="text-sm text-gray-500 mt-1">
            Filters applied: <span className="font-medium text-gray-700">Min Price ₹50</span> | High Horizon: <span className="font-medium text-gray-700">5 Years</span>
          </p>
        </div>
        <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-200">
          {stocks.length} Setups Found
        </span>
      </div>

      {stocks.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          No stocks currently meet the multi-year breakout criteria. Run the scanner API to populate data.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stocks.map((stock) => (
            <div key={stock.symbol} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{stock.symbol}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[150px]" title={stock.companyName}>{stock.companyName}</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${stock.distancePerc >= -1.5 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {stock.distancePerc.toFixed(2)}% to BO
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm pt-4 border-t border-gray-100">
                <div>
                  <span className="text-gray-400 text-[11px] uppercase tracking-wider block mb-1">CMP</span>
                  <p className="font-semibold text-gray-800">₹{stock.cmp}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px] uppercase tracking-wider block mb-1">5Y High</span>
                  <p className="font-semibold text-gray-800">₹{stock.fiveYearHigh}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-[11px] uppercase tracking-wider block mb-1">Vol Spk</span>
                  <p className="font-semibold text-blue-600">{stock.volumeRatio}x</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}