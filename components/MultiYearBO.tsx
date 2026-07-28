'use client';

import { useEffect, useState, useMemo } from 'react';

interface StockBreakout {
  id: number;
  symbol: string;
  companyName: string;
  currentPrice: number;
  highPrice: number;
  distanceFromHigh: number;
  baseLengthMonths: number;
  volumeSurge: number;
}

export default function MultiYearBO() {
  const [stocks, setStocks] = useState<StockBreakout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [minBaseMonths, setMinBaseMonths] = useState<number>(0);

  useEffect(() => {
    fetch('/api/multiyear-breakouts')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStocks(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load breakout stocks:", err);
        setLoading(false);
      });
  }, []);

  const filteredAndSortedStocks = useMemo(() => {
    return stocks
      .filter((stock) => stock.baseLengthMonths >= minBaseMonths)
      .sort((a, b) => b.distanceFromHigh - a.distanceFromHigh);
  }, [stocks, minBaseMonths]);

  // NEW: Function to generate and download TradingView Watchlist format
  const exportToTradingView = () => {
    if (filteredAndSortedStocks.length === 0) return;
    
    // Format required by TradingView: NSE:SYMBOL1,NSE:SYMBOL2
    const tvFormat = filteredAndSortedStocks.map(stock => `NSE:${stock.symbol}`).join(',');
    
    // Create a downloadable text file
    const blob = new Blob([tvFormat], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TV_Breakouts_${minBaseMonths}M_Base.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 text-gray-500 animate-pulse">
        Loading nightly scan data...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Potential Breakouts</h2>
          <p className="text-sm text-gray-500">
            Automated scan updated nightly. Sorted by closest to breakout point.
          </p>
        </div>

        {/* Filter Buttons & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
            <span className="text-sm font-semibold text-gray-500 ml-2 mr-1">Base Length:</span>
            {[
              { label: 'All', value: 0 },
              { label: '> 12M', value: 12 },
              { label: '> 24M', value: 24 },
              { label: '> 36M', value: 36 },
              { label: '> 48M', value: 48 },
              { label: '> 60M', value: 60 },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setMinBaseMonths(filter.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  minBaseMonths === filter.value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* NEW: TradingView Export Button */}
          <button 
            onClick={exportToTradingView}
            disabled={filteredAndSortedStocks.length === 0}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Export to TradingView
          </button>
        </div>
      </div>

      {/* Stock Cards Grid */}
      {filteredAndSortedStocks.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500 font-medium">
            No stocks found matching a base length of &gt; {minBaseMonths} months right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSortedStocks.map((stock) => (
            <div
              key={stock.id}
              className="border p-5 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between"
            >
              <div>
                <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-md">
                  {stock.baseLengthMonths} Month Base
                </div>

                <h3 className="font-bold text-xl text-gray-900 pr-28">
                  {stock.symbol}
                </h3>
                <p className="text-sm text-gray-500 truncate w-3/4 mt-0.5">
                  {stock.companyName}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="mt-6 pt-4 border-t grid grid-cols-2 gap-y-4">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Current
                  </span>
                  <span className="font-bold text-gray-800 text-lg">
                    ₹{stock.currentPrice}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Resistance
                  </span>
                  <span className="font-bold text-gray-800 text-lg">
                    ₹{stock.highPrice}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Volume Surge
                  </span>
                  <span className={`font-extrabold text-sm ${stock.volumeSurge >= 1.5 ? 'text-blue-600' : 'text-gray-600'}`}>
                    {stock.volumeSurge}x Avg
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Distance
                  </span>
                  <span
                    className={`font-extrabold text-base ${
                      stock.distanceFromHigh >= -3
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {stock.distanceFromHigh === 0
                      ? 'At High'
                      : `${stock.distanceFromHigh}%`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}