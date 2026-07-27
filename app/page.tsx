"use client";

import { useEffect, useState } from 'react';
import Papa from 'papaparse';

interface StockData {
  'Company Name': string;
  'Symbol': string;
  'Industry': string;
  'ISIN Code': string;
}

interface SeasonalityResult {
  winRate: number;
  averageReturn: number;
  maxDrawdown: number;
  totalYearsCounted: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export default function Home() {
  const [dashboardData, setDashboardData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasonalityCache, setSeasonalityCache] = useState<Record<string, SeasonalityResult>>({});
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);

  // New State for Search and Month Filter
  const [selectedMonth, setSelectedMonth] = useState<number>(7); // Defaults to August (index 7)
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchNiftyList() {
      try {
        const response = await fetch("/api/nifty");
        if (!response.ok) throw new Error("Failed to load Nifty 200 list");
        
        const csvText = await response.text();
        const result = Papa.parse(csvText, { header: true });
        setDashboardData(result.data as StockData[]);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchNiftyList();
  }, []);

  // Clear the cache whenever the user changes the target month
  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedMonth(Number(e.target.value));
    setSeasonalityCache({}); 
  }

  async function analyzeStock(symbol: string) {
    setAnalyzingSymbol(symbol);
    try {
      const response = await fetch(`/api/history?symbol=${symbol}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Unknown server error");
      }
      
      const history = await response.json();
      
      let wins = 0;
      let totalReturnOnWins = 0;
      let worstDrop = 0;
      let validYears = 0;

      history.forEach((monthData: any) => {
        const date = new Date(monthData.date);
        if (date.getMonth() === selectedMonth) {
          validYears++;
          const open = monthData.open;
          const close = monthData.close;
          const percentChange = ((close - open) / open) * 100;

          if (percentChange > 0) {
            wins++;
            totalReturnOnWins += percentChange;
          } else if (percentChange < worstDrop) {
            worstDrop = percentChange;
          }
        }
      });

      const winRate = validYears > 0 ? (wins / validYears) * 100 : 0;
      const averageReturn = wins > 0 ? (totalReturnOnWins / wins) : 0;

      setSeasonalityCache(prev => ({
        ...prev,
        [symbol]: {
          winRate,
          averageReturn,
          maxDrawdown: worstDrop,
          totalYearsCounted: validYears
        }
      }));

    } catch (error: any) {
      console.error(`Error analyzing ${symbol}:`, error);
      alert(`SYSTEM ERROR FOR ${symbol}:\n\n${error.message}`);
    } finally {
      setAnalyzingSymbol(null);
    }
  }

  // Filter the data based on the search query
  const filteredData = dashboardData.filter((stock) => {
    if (!stock['Company Name']) return false;
    const matchesSearch = 
      stock['Company Name'].toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock['Symbol'].toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <main className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">10-Year Seasonality System</h1>
        <p className="text-gray-600 mt-2 mb-6">Emotionless Execution Engine</p>
        
        {/* NEW CONTROLS SECTION */}
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Stock</label>
            <input 
              type="text" 
              placeholder="e.g. Reliance, ITC, BPCL..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          
          <div className="md:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Month</label>
            <select 
              value={selectedMonth} 
              onChange={handleMonthChange}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <p className="text-gray-600 font-medium animate-pulse">Loading Nifty 200 universe...</p>}
      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg shadow-sm">Error: {error}</div>}

      {!loading && !error && (
        <>
          <div className="mb-4 text-sm text-gray-500 font-medium">
            Showing {filteredData.length} stocks
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map((stock, index) => {
              const symbol = stock['Symbol'];
              const stats = seasonalityCache[symbol];
              const isAnalyzing = analyzingSymbol === symbol;

              return (
                <div key={index} className="p-5 border border-gray-200 rounded-xl shadow-sm bg-white hover:shadow-md transition-all">
                  <h2 className="text-lg font-bold text-gray-800 truncate" title={stock['Company Name']}>
                    {stock['Company Name']}
                  </h2>
                  <div className="mt-1 text-sm text-gray-500 mb-4">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{symbol}</span>
                    <span className="ml-2">{stock['Industry']}</span>
                  </div>

                  {stats ? (
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Win Rate:</span>
                        <span className={`font-bold ${stats.winRate >= 80 ? 'text-green-600' : 'text-gray-800'}`}>
                          {stats.winRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Avg Reward:</span>
                        <span className="font-bold text-green-600">+{stats.averageReturn.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Max Risk (Stop):</span>
                        <span className="font-bold text-red-600">{stats.maxDrawdown.toFixed(2)}%</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-2 text-right">
                        Based on {stats.totalYearsCounted} years of data
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => analyzeStock(symbol)}
                      disabled={isAnalyzing}
                      className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
                    >
                      {isAnalyzing ? "Analyzing..." : `Analyze for ${MONTHS[selectedMonth]}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}