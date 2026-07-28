'use client';
import { useEffect, useState } from 'react';

export default function MultiYearBO() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [lastScan, setLastScan] = useState<string>('Loading...');

  const fetchData = async () => {
    // Fetch Data
    const res = await fetch('/api/multiyear-breakouts');
    const data = await res.json();
    setStocks(data);

    // Fetch Status
    const statusRes = await fetch('/api/scanner/status');
    const statusData = await statusRes.json();
    if (statusData.lastRun) {
      const date = new Date(statusData.lastRun);
      setLastScan(date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">15-Year Accumulation Watchlist</h2>
        <button 
          onClick={fetchData}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Scan results from database (Last collected at {lastScan}hrs)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stocks.map((stock) => (
          <div key={stock.symbol} className="border p-4 rounded-xl bg-white shadow-sm">
             <h3 className="font-bold">{stock.symbol}</h3>
             <p className="text-sm text-gray-500">{stock.companyName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}