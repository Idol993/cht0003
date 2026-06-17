import React, { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, Calendar, Package, CheckCircle,
  AlertTriangle, Clock, Filter, Play, RefreshCw
} from 'lucide-react';
import { statisticsApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { StatisticsSummary, TrendData, CompanyStats } from '../../shared/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const Statistics: React.FC = () => {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [companyStats, setCompanyStats] = useState<CompanyStats[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [sizeData, setSizeData] = useState<any[]>([]);
  const [zoneData, setZoneData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: '',
    to: '',
  });
  const [trendDays, setTrendDays] = useState(7);
  const [executingCron, setExecutingCron] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [dateRange, trendDays]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        summaryData,
        trendData,
        companyData,
        hourlyData,
        sizeData,
        zoneData,
      ] = await Promise.all([
        statisticsApi.getSummary(),
        statisticsApi.getTrend(trendDays),
        statisticsApi.getCompanyStats(dateRange.from || undefined, dateRange.to || undefined),
        statisticsApi.getHourlyDistribution().catch(() => []),
        statisticsApi.getSizeDistribution().catch(() => []),
        statisticsApi.getZoneDistribution().catch(() => []),
      ]);

      setSummary(summaryData);
      setTrend(trendData);
      setCompanyStats(companyData);
      setHourlyData(hourlyData);
      setSizeData(sizeData);
      setZoneData(zoneData);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunReminders = async () => {
    setExecutingCron('reminders');
    try {
      await statisticsApi.runReminders();
      showToast('超时提醒任务执行完成', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setExecutingCron(null);
    }
  };

  const handleRunExpired = async () => {
    setExecutingCron('expired');
    try {
      await statisticsApi.runExpired();
      showToast('退回通知任务执行完成', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setExecutingCron(null);
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const summaryCards = summary ? [
    {
      title: '总入库量',
      value: summary.totalInbound,
      icon: Package,
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: '总取件量',
      value: summary.totalOutbound,
      icon: CheckCircle,
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-50',
    },
    {
      title: '当前待取',
      value: summary.pendingCount,
      icon: Clock,
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-50',
    },
    {
      title: '超时包裹',
      value: summary.overdueCount,
      icon: AlertTriangle,
      color: 'from-red-400 to-rose-500',
      bgColor: 'bg-red-50',
    },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            筛选条件
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={trendDays}
              onChange={(e) => setTrendDays(parseInt(e.target.value))}
              className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm"
            >
              <option value={7}>近7天</option>
              <option value={14}>近14天</option>
              <option value={30}>近30天</option>
            </select>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm"
            />
            <button
              onClick={loadData}
              className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              查询
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3">
            <Play className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-700">手动执行定时任务（测试用）：</span>
            <button
              onClick={handleRunReminders}
              disabled={executingCron !== null}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
            >
              {executingCron === 'reminders' && <RefreshCw className="w-3 h-3 animate-spin" />}
              发送超时提醒
            </button>
            <button
              onClick={handleRunExpired}
              disabled={executingCron !== null}
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
            >
              {executingCron === 'expired' && <RefreshCw className="w-3 h-3 animate-spin" />}
              处理超期退回
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-2xl p-6 border border-gray-100 bg-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                {index === 1 && summary && (
                  <p className="text-xs text-gray-400 mt-2">取件率：{summary.pickupRate.toFixed(1)}%</p>
                )}
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            入库/取件趋势
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="inbound"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  name="入库"
                />
                <Line
                  type="monotone"
                  dataKey="outbound"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                  name="取件"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            快递公司统计
          </h3>
          <div className="h-72 overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={400}>
              <BarChart data={companyStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  dataKey="companyName"
                  type="category"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  width={80}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="inboundCount" name="入库" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="outboundCount" name="取件" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            24小时入库分布
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="count" name="入库量" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">格口尺寸分布</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sizeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {sizeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {sizeData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-600">
                        {item.size === 'small' ? '小件' : item.size === 'medium' ? '中件' : '大件'}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4 text-sm">格口区域分布</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={zoneData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {zoneData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {zoneData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}
                      />
                      <span className="text-gray-600">{item.zone}区</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            快递公司明细
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  快递公司
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  入库量
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  取件量
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  待取件
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  取件率
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  超期件
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {companyStats.map((stat, index) => {
                const total = stat.inboundCount || 1;
                const rate = stat.outboundCount / total * 100;
                const overdueCount = stat.storedCount - stat.pickedCount - stat.returnedCount;
                
                return (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {stat.companyName?.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{stat.companyName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-900">{stat.inboundCount}</td>
                    <td className="px-6 py-4 text-center font-medium text-green-600">{stat.outboundCount}</td>
                    <td className="px-6 py-4 text-center font-medium text-yellow-600">{stat.pendingCount}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-medium ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-red-600">{overdueCount > 0 ? overdueCount : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
