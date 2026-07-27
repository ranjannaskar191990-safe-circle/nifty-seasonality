"use client";

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

interface StockData {
  'Company Name': string;
  'Symbol': string;
  'Industry': string;
  'ISIN Code': string;
}

interface YearlyReturn {
  year: number;
  return: number;
}

interface SeasonalityResult {
  winRate: number;
  averageReturn: number;
  maxDrawdown: number;
  totalYearsCounted: number;
  convictionScore: number;
  yearlyReturns: YearlyReturn[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Home() {
  const [dashboardData, setDashboardData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasonalityCache, setSeasonalityCache] = useState<Record<string, SeasonalityResult>>({});
  const [analyzingSymbol, setAnalyzingSymbol] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isScanningAll, setIsScanningAll] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [showTop5, setShowTop5] = useState(false);

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

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedMonth(Number(e.target.value));
    setSeasonalityCache({}); 
    setShowTop5(false);
  }

  async function analyzeStock(symbol: string, silent = false) {
    if (!silent) setAnalyzingSymbol(symbol);
    try {
      const response = await fetch(`/api/history?symbol=${symbol}`);
      
      if (!response.ok) throw new Error("Server error");
      
      const history = await response.json();
      
      let wins = 0;
      let totalReturnOnWins = 0;
      let worstDrop = 0;
      let validYears = 0;
      const yearlyReturns: YearlyReturn[] = [];

      history.forEach((monthData: any) => {
        const date = new Date(monthData.date);
        if (date.getMonth() === selectedMonth) {
          validYears++;
          const open = monthData.open;
          const close = monthData.close;
          const percentChange = ((close - open) / open) * 100;
          
          yearlyReturns.push({
            year: date.getFullYear(),
            return: percentChange
          });

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
      const dataCompletenessScore = (validYears / 10) * 100;
      const convictionScore = Math.round((winRate * 0.7) + (dataCompletenessScore * 0.3));

      yearlyReturns.sort((a, b) => a.year - b.year);

      setSeasonalityCache(prev => ({
        ...prev,
        [symbol]: {
          winRate,
          averageReturn,
          maxDrawdown: worstDrop,
          totalYearsCounted: validYears,
          convictionScore,
          yearlyReturns
        }
      }));

    } catch (error: any) {
      console.error(`Error analyzing ${symbol}:`, error);
      if (!silent) alert(`SYSTEM ERROR FOR ${symbol}:\n\n${error.message}`);
    } finally {
      if (!silent) setAnalyzingSymbol(null);
    }
  }

  async function runFullScan() {
    setIsScanningAll(true);
    setShowTop5(false);
    const stocksToScan = dashboardData
      .filter((s) => s['Company Name'] && !seasonalityCache[s['Symbol']]);
    
    let completed = 0;
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < stocksToScan.length; i += BATCH_SIZE) {
      const batch = stocksToScan.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (stock) => {
          await analyzeStock(stock['Symbol'], true);
          completed++;
          setScanProgress(`${completed} / ${stocksToScan.length}`);
        })
      );
    }
    
    setIsScanningAll(false);
    setScanProgress("");
  }

  const filteredData = dashboardData.filter((stock) => {
    if (!stock['Company Name']) return false;
    const matchesSearch = 
      stock['Company Name'].toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock['Symbol'].toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const statsA = seasonalityCache[a['Symbol']];
    const statsB = seasonalityCache[b['Symbol']];

    if (statsA && statsB) {
      if (statsB.convictionScore !== statsA.convictionScore) {
        return statsB.convictionScore - statsA.convictionScore;
      }
      return statsB.averageReturn - statsA.averageReturn;
    }
    
    if (statsA && !statsB) return -1;
    if (!statsA && statsB) return 1;
    return 0; 
  });

  const finalDisplayData = showTop5 
    ? sortedData.filter(stock => seasonalityCache[stock['Symbol']]).slice(0, 5)
    : sortedData;

  const getChartData = () => {
    if (!showTop5 || finalDisplayData.length === 0) return [];
    const chartDataMap = new Map<number, any>();
    const currentYear = new Date().getFullYear();
    
    for (let y = currentYear - 10; y <= currentYear; y++) {
      chartDataMap.set(y, { year: y.toString() });
    }

    finalDisplayData.forEach((stock) => {
      const symbol = stock['Symbol'];
      const stats = seasonalityCache[symbol];
      if (stats && stats.yearlyReturns) {
        stats.yearlyReturns.forEach(yr => {
          if (chartDataMap.has(yr.year)) {
            const dataPoint = chartDataMap.get(yr.year);
            dataPoint[symbol] = parseFloat(yr.return.toFixed(2));
          }
        });
      }
    });

    return Array.from(chartDataMap.values()).filter(d => Object.keys(d).length > 1);
  };

  const chartData = getChartData();

  return (
    <main className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">10-Year Seasonality System</h1>
            <p className="text-gray-600 mt-2">Emotionless Execution Engine</p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowTop5(!showTop5)}
              disabled={isScanningAll || Object.keys(seasonalityCache).length === 0}
              className={`px-4 py-3 font-bold rounded-lg transition-colors shadow-sm ${showTop5 ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'} disabled:opacity-50`}
            >
              {showTop5 ? "Show All Scanned" : "⭐ Top 5 Setups"}
            </button>

            <button 
              onClick={runFullScan}
              disabled={isScanningAll || loading}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm flex flex-col items-center justify-center min-w-[200px]"
            >
              {isScanningAll ? (
                <>
                  <span>Scanning Market...</span>
                  <span className="text-xs font-normal opacity-80">{scanProgress}</span>
                </>
              ) : (
                "Run Full Market Scan"
              )}
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Stock</label>
            <input 
              type="text" 
              placeholder="e.g. Reliance, ITC..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={showTop5}
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
          {showTop5 && chartData.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Historical Comparison ({MONTHS[selectedMonth]})</h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                    <YAxis 
                      tickFormatter={(val) => `${val}%`} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#6b7280', fontSize: 12}}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, undefined]}
                      cursor={{fill: '#f3f4f6'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                    
                    {finalDisplayData.map((stock, idx) => (
                      <Bar 
                        key={stock['Symbol']} 
                        dataKey={stock['Symbol']} 
                        name={stock['Symbol']} 
                        fill={CHART_COLORS[idx % CHART_COLORS.length]} 
                        radius={[4, 4, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {finalDisplayData.map((stock, index) => {
              const symbol = stock['Symbol'];
              const stats = seasonalityCache[symbol];
              const isAnalyzing = analyzingSymbol === symbol;

              // Calculate the System Stop Loss (Max Drawdown + 1% Buffer)
              const systemStopLoss = stats ? Math.min(stats.maxDrawdown - 1, -2) : 0; // Ensures at least a 2% minimum stop

              return (
                <div key={`${symbol}-${index}`} className={`p-5 border rounded-xl shadow-sm transition-all flex flex-col ${stats && stats.convictionScore >= 80 ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                  <div className="flex justify-between items-start">
                    <h2 className="text-lg font-bold text-gray-800 truncate" title={stock['Company Name']}>
                      {stock['Company Name']}
                    </h2>
                    {stats && (
                      <div className={`px-2 py-1 rounded text-xs font-bold ${stats.convictionScore >= 80 ? 'bg-green-200 text-green-800' : stats.convictionScore >= 60 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                        Score: {stats.convictionScore}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-500 mb-4">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{symbol}</span>
                    <span className="ml-2">{stock['Industry']}</span>
                  </div>

                  {stats ? (
                    <div className="flex-1 flex flex-col gap-4">
                      {/* STATS SECTION */}
                      <div className="bg-white p-3 rounded-lg border border-gray-100 space-y-2 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Win Rate:</span>
                          <span className={`font-bold text-lg ${stats.winRate >= 80 ? 'text-green-600' : 'text-gray-800'}`}>
                            {stats.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Avg Reward:</span>
                          <span className="font-bold text-green-600">+{stats.averageReturn.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Worst Drop:</span>
                          <span className="font-bold text-red-600">{stats.maxDrawdown.toFixed(2)}%</span>
                        </div>
                      </div>

                      {/* EXECUTION PLAN SECTION */}
                      <div className="bg-gray-900 p-4 rounded-lg shadow-sm mt-auto text-gray-100">
                        <div className="text-xs uppercase font-bold text-gray-400 mb-3 tracking-wider border-b border-gray-700 pb-2">Execution Plan</div>
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Entry (Market Open):</span>
                            <span className="font-semibold text-white">1st of {MONTHS[selectedMonth]}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Exit (Market Close):</span>
                            <span className="font-semibold text-white">End of {MONTHS[selectedMonth]}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                            <span className="text-red-400 font-medium">GTT Stop Loss:</span>
                            <span className="font-bold text-red-400">{systemStopLoss.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => analyzeStock(symbol)}
                      disabled={isAnalyzing || isScanningAll}
                      className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 transition-colors mt-auto"
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