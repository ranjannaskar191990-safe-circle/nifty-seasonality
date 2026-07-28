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
  const [isScanning, setIsScanning] = useState(false); // New state for the scanner button

  // Function to load data from the database
  const fetchBreakouts = async () => {
    try {
      const res = await fetch('/api/multiyear-breakouts');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setStocks(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on initial render
  useEffect(() => {
    fetchBreakouts();
  }, []);

  // NEW: Function to trigger the scanner API
  const runScanner = async () => {
    setIsScanning(true);
    setError('');
    try {
      const res = await fetch('/api/cron/scan-breakouts');
      if (!res.ok) throw new Error('Scanner API failed to complete. It may have timed out.');
      
      // If the scan is successful, fetch the fresh data from the database
      await fetchBreakouts();
    } catch (err: any) {
      setError(`Scan Error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 font-medium">Loading Setups from Neon Database...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {error && (
        <div className="p-4 text-red-700 bg-red-50 rounded-md border border-red-200 shadow-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-Year Breakout Scanner</h2>
          <p className="text-sm text-gray-500 mt-1">
            Filters applied: <span className="font-medium text-gray-700">Min Price ₹50</span> | Consolidation: <span className="font-medium text-gray-700">&gt; 5 Years</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-200">
            {stocks.length} Setups Found
          </span>
          
          {/* NEW: The Scan Button */}
          <button 
            onClick={runScanner} 
            disabled={isScanning}
            className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center shadow-sm"
          >
            {isScanning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Scanning NSE...
              </>
            ) : (
              "Run 15-Year Scan"
            )}
          </button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <p className="mb-4 text-lg font-medium text-gray-600">No stocks currently meet the decade-long breakout criteria.</p>
          <p className="text-sm">Click the <strong>Run 15-Year Scan</strong> button above to search the market.</p>
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
                  <span className="text-gray-400 text-[11px] uppercase tracking-wider block mb-1">15Y High</span>
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