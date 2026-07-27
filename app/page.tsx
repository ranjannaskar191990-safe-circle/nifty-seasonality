"use client";

import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';

interface StockData {
  'Company Name': string;
  'Symbol': string;
  'Industry': string;
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

// Math helper for calculating Exponential Moving Averages (EMA)
const calculateEMA = (data: any[], period: number) => {
  const k = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  return data.map((d: any) => {
    ema = (d.close - ema) * k + ema;
    return parseFloat(ema.toFixed(2));
  });
};

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
  const [portfolio, setPortfolio] = useState<Record<number, string[]>>({});

  // Tactical Chart & Risk Manager State
  const [activeDetailedStock, setActiveDetailedStock] = useState<string | null>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [riskPerTrade, setRiskPerTrade] = useState<number>(5000);

  useEffect(() => {
    async function fetchNiftyList() {
      try {
        const response = await fetch("/api/nifty");
        if (!response.ok) throw new Error("Failed to load list");
        const csvText = await response.text();
        const result = Papa.parse(csvText, { header: true });
        setDashboardData(result.data as StockData[]);
      } catch (err: any) {
        setError("Error loading data");
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

  function toggleTrade(symbol: string) {
    setPortfolio(prev => {
      const monthPortfolio = prev[selectedMonth] || [];
      if (monthPortfolio.includes(symbol)) {
        return { ...prev, [selectedMonth]: monthPortfolio.filter(s => s !== symbol) };
      } else {
        return { ...prev, [selectedMonth]: [...monthPortfolio, symbol] };
      }
    });
  }

  function removeTradeFromPanel(symbol: string, monthIndex: number) {
    setPortfolio(prev => {
      const monthPortfolio = prev[monthIndex] || [];
      return { ...prev, [monthIndex]: monthPortfolio.filter(s => s !== symbol) };
    });
  }

  const calculateAllocation = (symbol: string) => {
    const stats = seasonalityCache[symbol];
    if (!stats) return 0;
    const stopLossPercent = Math.abs(Math.min(stats.maxDrawdown - 1, -2));
    return Math.round(riskPerTrade / (stopLossPercent / 100));
  };

  async function openTacticalView(symbol: string) {
    setActiveDetailedStock(symbol);
    setIsLoadingWeekly(true);
    setWeeklyData([]);
    
    try {
      const response = await fetch(`/api/history-weekly?symbol=${symbol}`);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      
      const ema20 = calculateEMA(data, 20);
      const ema50 = calculateEMA(data, 50);
      
      setWeeklyData(data.map((d: any, i: number) => ({
        ...d,
        EMA20: ema20[i],
        EMA50: ema50[i]
      })));
    } catch (error) {
      console.error("Failed to load weekly chart");
    } finally {
      setIsLoadingWeekly(false);
    }
  }

  async function analyzeStock(symbol: string, silent = false) {
    if (!silent) setAnalyzingSymbol(symbol);
    try {
      const response = await fetch(`/api/history?symbol=${symbol}`);
      if (!response.ok) throw new Error("Server error");
      const history = await response.json();
      
      let wins = 0, totalReturnOnWins = 0, worstDrop = 0, validYears = 0;
      const yearlyReturns: YearlyReturn[] = [];

      history.forEach((monthData: any) => {
        const date = new Date(monthData.date);
        if (date.getMonth() === selectedMonth) {
          validYears++;
          const open = monthData.open;
          const close = monthData.close;
          const percentChange = ((close - open) / open) * 100;
          
          yearlyReturns.push({ year: date.getFullYear(), return: percentChange });
          if (percentChange > 0) { wins++; totalReturnOnWins += percentChange; } 
          else if (percentChange < worstDrop) { worstDrop = percentChange; }
        }
      });

      const winRate = validYears > 0 ? (wins / validYears) * 100 : 0;
      const averageReturn = wins > 0 ? (totalReturnOnWins / wins) : 0;
      const dataCompletenessScore = (validYears / 10) * 100;
      const convictionScore = Math.round((winRate * 0.7) + (dataCompletenessScore * 0.3));

      yearlyReturns.sort((a, b) => a.year - b.year);

      setSeasonalityCache(prev => ({
        ...prev,
        [symbol]: { winRate, averageReturn, maxDrawdown: worstDrop, totalYearsCounted: validYears, convictionScore, yearlyReturns }
      }));
    } catch (error: any) {
      if (!silent) alert(`ERROR FOR ${symbol}: ${error.message}`);
    } finally {
      if (!silent) setAnalyzingSymbol(null);
    }
  }

  async function runFullScan() {
    setIsScanningAll(true);
    setShowTop5(false);
    const stocksToScan = dashboardData.filter((s) => s['Company Name'] && !seasonalityCache[s['Symbol']]);
    let completed = 0;
    
    for (let i = 0; i < stocksToScan.length; i += 5) {
      const batch = stocksToScan.slice(i, i + 5);
      await Promise.all(batch.map(async (stock) => {
        await analyzeStock(stock['Symbol'], true);
        completed++;
        setScanProgress(`${completed} / ${stocksToScan.length}`);
      }));
    }
    setIsScanningAll(false);
    setScanProgress("");
  }

  const filteredData = dashboardData.filter((stock) => {
    if (!stock['Company Name']) return false;
    return stock['Company Name'].toLowerCase().includes(searchQuery.toLowerCase()) || stock['Symbol'].toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const statsA = seasonalityCache[a['Symbol']];
    const statsB = seasonalityCache[b['Symbol']];
    if (statsA && statsB) {
      if (statsB.convictionScore !== statsA.convictionScore) return statsB.convictionScore - statsA.convictionScore;
      return statsB.averageReturn - statsA.averageReturn;
    }
    if (statsA && !statsB) return -1;
    if (!statsA && statsB) return 1;
    return 0; 
  });

  const finalDisplayData = showTop5 ? sortedData.filter(stock => seasonalityCache[stock['Symbol']]).slice(0, 5) : sortedData;

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
            chartDataMap.get(yr.year)[symbol] = parseFloat(yr.return.toFixed(2));
          }
        });
      }
    });
    return Array.from(chartDataMap.values()).filter(d => Object.keys(d).length > 1);
  };

  const chartData = getChartData();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 relative">
      
      {/* 52-WEEK EMA TACTICAL MODAL */}
      {activeDetailedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
              <div>
                <h3 className="font-bold text-xl">{activeDetailedStock}</h3>
                <p className="text-xs text-gray-400">52-Week Tactical Trend (Price, 20 EMA, 50 EMA)</p>
              </div>
              <button onClick={() => setActiveDetailedStock(null)} className="text-gray-400 hover:text-white text-2xl px-2">✕</button>
            </div>
            
            <div className="p-6 h-[400px] w-full bg-gray-50">
              {isLoadingWeekly ? (
                <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 animate-pulse">Loading Live Market Data...</div>
              ) : weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none'}} itemStyle={{color: '#fff'}} />
                    <Legend />
                    <Line type="monotone" dataKey="close" stroke="#1f2937" dot={false} strokeWidth={2} name="Price (Close)" />
                    <Line type="monotone" dataKey="EMA20" stroke="#f59e0b" dot={false} strokeWidth={2} name="20-Week EMA" />
                    <Line type="monotone" dataKey="EMA50" stroke="#8b5cf6" dot={false} strokeWidth={2} name="50-Week EMA" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-red-500">Failed to load chart data.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN DASHBOARD */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">10-Year Seasonality System</h1>
                <p className="text-gray-600 mt-2">Emotionless Execution Engine</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTop5(!showTop5)} disabled={isScanningAll || Object.keys(seasonalityCache).length === 0} className={`px-4 py-3 font-bold rounded-lg transition-colors shadow-sm ${showTop5 ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'} disabled:opacity-50`}>
                  {showTop5 ? "Show All Scanned" : "⭐ Top 5 Setups"}
                </button>
                <button onClick={runFullScan} disabled={isScanningAll || loading} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm flex flex-col items-center justify-center min-w-[200px]">
                  {isScanningAll ? <><span className="text-sm">Scanning Market...</span><span className="text-xs font-normal opacity-80">{scanProgress}</span></> : "Run Full Market Scan"}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm mt-6">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Stock</label>
                <input type="text" placeholder="e.g. Reliance, ITC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" disabled={showTop5} />
              </div>
              <div className="md:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Month</label>
                <select value={selectedMonth} onChange={handleMonthChange} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer">
                  {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                </select>
              </div>
            </div>
          </div>

          {!loading && !error && (
            <>
              {showTop5 && chartData.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 animate-in fade-in duration-500">
                  <h3 className="text-xl font-bold text-gray-800 mb-6">Historical Comparison ({MONTHS[selectedMonth]})</h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                        <YAxis tickFormatter={(val) => `${val}%`} axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                        <Tooltip formatter={(value: number) => [`${value}%`, undefined]} cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                        {finalDisplayData.map((stock, idx) => (
                          <Bar key={stock['Symbol']} dataKey={stock['Symbol']} name={stock['Symbol']} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                {finalDisplayData.map((stock, index) => {
                  const symbol = stock['Symbol'];
                  const stats = seasonalityCache[symbol];
                  const isAnalyzing = analyzingSymbol === symbol;
                  const systemStopLoss = stats ? Math.min(stats.maxDrawdown - 1, -2) : 0; 
                  const isSelectedForTrade = (portfolio[selectedMonth] || []).includes(symbol);

                  return (
                    <div key={`${symbol}-${index}`} className={`p-5 border rounded-xl shadow-sm transition-all flex flex-col ${stats && stats.convictionScore >= 80 ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                      <div className="flex justify-between items-start">
                        <h2 className="text-lg font-bold text-gray-800 truncate" title={stock['Company Name']}>{stock['Company Name']}</h2>
                        {stats && <div className={`px-2 py-1 rounded text-xs font-bold ${stats.convictionScore >= 80 ? 'bg-green-200 text-green-800' : stats.convictionScore >= 60 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>Score: {stats.convictionScore}</div>}
                      </div>
                      
                      <div className="mt-1 text-sm text-gray-500 mb-4">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{symbol}</span>
                        <span className="ml-2">{stock['Industry']}</span>
                      </div>

                      {stats ? (
                        <div className="flex-1 flex flex-col gap-4">
                          <div className="bg-white p-3 rounded-lg border border-gray-100 space-y-2 shadow-sm">
                            <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-600">Win Rate:</span><span className={`font-bold text-lg ${stats.winRate >= 80 ? 'text-green-600' : 'text-gray-800'}`}>{stats.winRate.toFixed(1)}%</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-600">Avg Reward:</span><span className="font-bold text-green-600">+{stats.averageReturn.toFixed(2)}%</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm font-medium text-gray-600">Worst Drop:</span><span className="font-bold text-red-600">{stats.maxDrawdown.toFixed(2)}%</span></div>
                          </div>

                          <div className="bg-gray-900 p-4 rounded-lg shadow-sm mt-auto text-gray-100">
                            <div className="text-xs uppercase font-bold text-gray-400 mb-3 tracking-wider border-b border-gray-700 pb-2">Execution Plan</div>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between items-center"><span className="text-gray-400">Entry (Market Open):</span><span className="font-semibold text-white">1st of {MONTHS[selectedMonth]}</span></div>
                              <div className="flex justify-between items-center"><span className="text-gray-400">Exit (Market Close):</span><span className="font-semibold text-white">End of {MONTHS[selectedMonth]}</span></div>
                              
                              <div className="flex justify-between items-center pt-2 border-t border-gray-700"><span className="text-yellow-500 font-medium">No-Trade Gap:</span><span className="font-bold text-yellow-500">Max +1.5%</span></div>
                              <div className="flex justify-between items-center"><span className="text-green-400 font-medium">Profit Target:</span><span className="font-bold text-green-400">+{stats.averageReturn.toFixed(2)}%</span></div>
                              <div className="flex justify-between items-center"><span className="text-red-400 font-medium">GTT Stop Loss:</span><span className="font-bold text-red-400">{systemStopLoss.toFixed(2)}%</span></div>
                            </div>
                            
                            <button onClick={() => toggleTrade(symbol)} className={`w-full py-2.5 mt-4 rounded-md font-bold transition-all border ${isSelectedForTrade ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-700' : 'bg-transparent border-gray-500 text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                              {isSelectedForTrade ? `✓ Added to ${MONTHS[selectedMonth]}` : `+ Select to Trade`}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => analyzeStock(symbol)} disabled={isAnalyzing || isScanningAll} className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-300 transition-colors mt-auto">
                          {isAnalyzing ? "Analyzing..." : `Analyze for ${MONTHS[selectedMonth]}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* PORTFOLIO & RISK SIDEBAR */}
      <aside className="w-full lg:w-80 xl:w-96 bg-white border-l border-gray-200 shadow-lg lg:h-screen lg:sticky lg:top-0 overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">Trading Calendar</h2>
          <p className="text-sm text-gray-500 mt-1">Click a ticker to view EMA Trend</p>
        </div>

        <div className="p-4 border-b border-gray-200 bg-white">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Risk Manager</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">₹</span>
            <input 
              type="number" 
              value={riskPerTrade} 
              onChange={(e) => setRiskPerTrade(Number(e.target.value))}
              className="w-full border border-gray-300 rounded p-1 text-sm focus:outline-none focus:border-blue-500"
              title="Max Risk per Trade"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">Risk/Trade</span>
          </div>
        </div>
        
        <div className="p-6 flex-1 space-y-6">
          {MONTHS.map((monthName, mIndex) => {
            const stocksForMonth = portfolio[mIndex] || [];
            return (
              <div key={mIndex} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between items-center mb-3">
                  <h3 className={`font-bold ${mIndex === selectedMonth ? 'text-blue-600' : 'text-gray-700'}`}>{monthName}</h3>
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stocksForMonth.length}</span>
                </div>
                
                {stocksForMonth.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No setups selected.</p>
                ) : (
                  <ul className="space-y-2">
                    {stocksForMonth.map(sym => (
                      <li key={sym} className="flex flex-col text-sm bg-white border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all rounded p-2">
                        <div className="flex justify-between items-center">
                          <button onClick={() => openTacticalView(sym)} className="font-mono font-bold text-blue-600 hover:text-blue-800 flex-1 text-left">{sym}</button>
                          <button onClick={() => removeTradeFromPanel(sym, mIndex)} className="text-gray-400 hover:text-red-500 transition-colors ml-3 font-bold">✕</button>
                        </div>
                        
                        {/* Dynamic Capital Allocation Display */}
                        {mIndex === selectedMonth && seasonalityCache[sym] && (
                          <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-1 flex justify-between">
                            <span>Req. Capital:</span>
                            <span className="font-bold text-gray-800">₹{calculateAllocation(sym).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </aside>

    </div>
  );
}