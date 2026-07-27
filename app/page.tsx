import Papa from 'papaparse';

// Fetch the Nifty 200 data directly
async function getDashboardData() {
  const url = "https://nsearchives.nseindia.com/content/indices/ind_nifty200list.csv";
  const response = await fetch(url);
  const csvText = await response.text();
  
  // Parse CSV text into JSON
  const result = Papa.parse(csvText, { header: true });
  return result.data; // This returns your array of stocks
}

export default async function Home() {
  const dashboardData: any[] = await getDashboardData();

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-5">My Nifty 200 Tracker</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dashboardData.map((stock, index) => (
          <div key={index} className="p-4 border rounded shadow">
            <h2 className="font-bold">{stock['Company Name']}</h2>
            <p>Symbol: {stock['Symbol']}</p>
            <p>Industry: {stock['Industry']}</p>
          </div>
        ))}
      </div>
    </main>
  );
}