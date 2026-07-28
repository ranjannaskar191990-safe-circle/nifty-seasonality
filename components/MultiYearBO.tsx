'use client';
import { useEffect, useState } from 'react';

export default function MultiYearBO() {
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/multiyear-breakouts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStocks(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load stocks:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500 animate-pulse">Loading nightly scan data...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Potential Breakouts</h2>
        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
          Nightly Automated Scan
        </span>
      </div>

      {stocks.length === 0 ? (
         <p className="text-gray-500">No stocks in the breakout zone right now. Check back tomorrow!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {stocks.map((stock) => (
            <div key={stock.id} className="border p-4 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow relative">
               
               {/* NEW: Base Length Badge */}
               <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-md">
                 {stock.baseLengthMonths} Month Base
               </div>

               <h3 className="font-bold text-lg text-gray-800 pr-24">{stock.symbol}</h3>
               <p className="text-sm text-gray-500 truncate w-3/4">{stock.companyName}</p>
               
               <div className="mt-4 pt-4 border-t flex justify-between items-center">
                 <span className="font-medium text-gray-700">₹{stock.currentPrice}</span>
                 <span className={`font-semibold ${stock.distanceFromHigh >= -5 ? "text-green-600" : "text-orange-500"}`}>
                   {stock.distanceFromHigh}% from ATH
                 </span>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}