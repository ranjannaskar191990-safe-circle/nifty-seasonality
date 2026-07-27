"use client"; // This tells Next.js to run this on the user's browser, not the build server
import { useEffect, useState } from 'react';
import Papa from 'papaparse';

export default function Home() {
  const [dashboardData, setDashboardData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const url = "https://nsearchives.nseindia.com/content/indices/ind_nifty200list.csv";
      const response = await fetch(url);
      const csvText = await response.text();
      const result = Papa.parse(csvText, { header: true });
      setDashboardData(result.data);
    }
    fetchData();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-5">My Nifty 200 Tracker</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboardData.length > 0 ? (
          dashboardData.map((stock, index) => (
            <div key={index} className="p-4 border rounded shadow">
              <h2 className="font-bold">{stock['Company Name']}</h2>
              <p>Symbol: {stock['Symbol']}</p>
              <p>Industry: {stock['Industry']}</p>
            </div>
          ))
        ) : (
          <p>Loading data...</p>
        )}
      </div>
    </main>
  );
}