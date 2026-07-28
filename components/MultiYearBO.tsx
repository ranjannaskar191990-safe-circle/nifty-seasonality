'use client';

import { useEffect, useState, useMemo } from 'react';

interface StockBreakout {
  id: number;
  symbol: string;
  companyName: string;
  currentPrice: number;
  distanceFromHigh: number;
  baseLengthMonths: number;
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

  // Filter stocks based on selected base threshold, then sort closest to breakout (descending distanceFromHigh)
  const filteredAndSortedStocks = useMemo(() => {
    return stocks
      .filter((stock) => stock.baseLengthMonths >= minBaseMonths)
      .sort((a, b) => b.distanceFromHigh - a.distanceFromHigh);
  }, [stocks, minBaseMonths]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Potential Breakouts</h2>
          <p className="text-sm text-gray-500">
            Automated scan updated nightly. Sorted by closest to breakout point.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-600 mr-1">Base Length:</span>
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                minBaseMonths === filter.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
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
                {/* Base Length Badge */}
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

              <div className="mt-6 pt-4 border-t flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Current Price
                  </span>
                  <span className="font-bold text-gray-800 text-lg">
                    ₹{stock.currentPrice}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block">
                    Distance to Breakout
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