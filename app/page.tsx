"use client";

import { useEffect, useState } from 'react';
import Papa from 'papaparse';

export default function Home() {
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const url = "https://nsearchives.nseindia.com/content/indices/ind_nifty200list.csv";
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error("Failed to fetch Nifty 200 data from source.");
        }

        const csvText = await response.text();
        const result = Papa.parse(csvText, { header: true });
        
        setDashboardData(result.data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Nifty 200 Dashboard</h1>

      {loading && (
        <p className="text-gray-600">Loading Nifty 200 stocks...</p>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData
            .filter((stock) => stock['Company Name']) // Filter empty rows
            .map((stock, index) => (
              <div 
                key={index} 
                className="p-5 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-white"
              >
                <h2 className="text-lg font-semibold text-gray-800">{stock['Company Name']}</h2>
                <div className="mt-2 text-sm text-gray-600">
                  <p><span className="font-medium text-gray-700">Symbol:</span> {stock['Symbol']}</p>
                  <p><span className="font-medium text-gray-700">Industry:</span> {stock['Industry']}</p>
                  <p><span className="font-medium text-gray-700">ISIN:</span> {stock['ISIN Code']}</p>
                </div>
              </div>
            ))}
        </div>
      )}
    </main>
  );
}