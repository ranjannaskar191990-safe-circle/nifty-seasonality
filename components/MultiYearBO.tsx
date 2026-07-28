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
}

export default function MultiYearBO() {
  const [stocks, setStocks] = useState<BreakoutStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

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

  useEffect(() => {
    fetchBreakouts();
  }, []);

  const runFullMarketScan = async () => {
    setIsScanning(true);
    setError('');
    
    try {
      setScanProgress('Fetching Nifty Total Market list (750 stocks)...');
      const initRes = await fetch('/api/scanner/init');
      if (!initRes.ok) throw new Error('Failed to initialize scan');
      const { stocks: stockList } = await initRes.json();

      // YOUR RULE: Batch size of 75
      const BATCH_SIZE = 75; 
      let completed = 0;

      for (let i = 0; i < stockList.length; i += BATCH_SIZE) {
        const batch = stockList.slice(i, i + BATCH_SIZE);
        setScanProgress(`Scanning ${completed + batch.length} of ${stockList.length} stocks...`);
        
        await fetch('/api/scanner/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch })
        });
        
        completed += batch.length;

        // YOUR RULE: 5 second pause between batches
        if (completed < stockList.length) {
            setScanProgress(`Cooling down (5s pause)... (${completed}/${stockList.length})`);
            await new Promise(resolve => setTimeout(resolve, 5000)); 
        }
      }

      setScanProgress('Scan complete! Loading results...');
      await fetchBreakouts();
    } catch (err: any) {
      setError(`Scan Error: ${err.message}`);
    } finally {
      setIsScanning(false);
      setScanProgress('');
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
          <h2 className="text-2xl font-bold text-gray-900">15-Year Base Scanner</h2>
          <p className="text-sm text-gray-500 mt-1">
            Filters applied: <span className="font-medium text-gray-700">Min Price ₹50</span> | Consolidation: <span className="font-medium text-gray-700">&gt; 5 Years</span>
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-200">
            {stocks.length} Setups Found
          </span>
          
          <button 
            onClick={runFullMarketScan} 
            disabled={isScanning}
            className="px-5 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center shadow-sm min-w-[200px] justify-center"
          >
            {isScanning ? (
              <div className="flex flex-col items-center">
                <div className="text-sm">Scanning Market...</div>
                <div className="text-xs font-normal text-gray-300">{scanProgress}</div>
              </div>
            ) : (
              "Run Full Market Scan"
            )}
          </button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <p className="mb-4 text-lg font-medium text-gray-600">No stocks currently meet the decade-long breakout criteria.</p>
          <p className="text-sm">Click the <strong>Run Full Market Scan</strong> button above to search 750 NSE stocks.</p>
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