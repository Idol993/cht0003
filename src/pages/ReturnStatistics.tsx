import React, { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, Clock, CheckCircle,
  AlertTriangle, Filter, RefreshCw, Package,
  XCircle, CheckCheck, Timer
} from 'lucide-react';
import { statisticsApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import {
  ReturnStatsSummary, ReturnStatsByCompany, ReturnStatsByDate,
  Company, RETURN_REASON_OPTIONS
} from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const ReturnStatistics: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [summary, setSummary] = useState<ReturnStatsSummary | null>(null);
  const [byCompany, setByCompany] = useState<ReturnStatsByCompany[]>([]);
  const [byDate, setByDate] = useState<ReturnStatsByDate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState({
    from: '',
    to: '',
  });
  const [trendDays, setTrendDays] = useState(7);
  const [companyFilter, setCompanyFilter] = useState<string>('');

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, trendDays, companyFilter]);

  const loadCompanies = async () => {
    try {
      if (user?.role !== 'resident') {
        const data = await userApi.getCompanies();
        setCompanies(data);
        if (user?.role === 'courier' && user.companyId) {
          setCompanyFilter(String(user.companyId));
        }
      }
    } catch { }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (companyFilter) params.companyId = parseInt(companyFilter);
      if (dateRange.from) params.startDate = dateRange.from;
      if (dateRange.to) params.endDate = dateRange.to;
      if (!dateRange.from && !dateRange.to) {
        params.days = trendDays;
      }

      const [summaryData, companyData, dateData] = await Promise.all([
        statisticsApi.getReturnSummary(params),
        statisticsApi.getReturnByCompany(params),
        statisticsApi.getReturnByDate(params),
      ]);

      setSummary(summaryData);
      setByCompany(companyData);
      setByDate(dateData);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const reasonData = summary?.commonFailReasons?.map((item, index) => ({
    name: item.reason,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const chartData = byDate.map(item => ({
    date: item.date,
    待退回: item.pending,
    已退回: item.returned,
  }));

  const companyChartData = byCompany.map(item => ({
    name: item.companyName,
    待退回: item.pending,
    已退回: item.returned,
  }));

  const summaryCards = summary ? [
    {
      title: '待退回总数',
      value: summary.totalPending,
      icon: Clock,
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-50',
    },
    {
      title: '已退回总数',
      value: summary.totalReturned,
      icon: CheckCircle,
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-50',
    },
    {
      title: '批量退回成功率',
      value: `${(summary.batchSuccessRate * 100).toFixed(1)}%`,
      icon: CheckCheck,
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: '平均处理时长',
      value: `${summary.batchTotal > 0 ? (summary.totalReturned / summary.batchTotal * 7).toFixed(1) : '0'}天`,
      icon: Timer,
      color: 'from-purple-400 to-pink-500',
      bgColor: 'bg-purple-50',
    },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            筛选条件
          </h3>
          <div className="flex items-center gap-3">
            {user?.role !== 'courier' && (
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm"
              >
                <option value="">全部快递公司</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <select
              value={trendDays}
              onChange={(e) => {
                setTrendDays(parseInt(e.target.value));
                setDateRange({ from: '', to: '' });
              }}
              className="px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-sm"
            >
              <option value={7}>近7天</option>
              <option value={14}>近14天</option>
              <option value={30}>近30天</option>
              <option value={90}>近90天</option>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} rounded-2xl p-6 border border-gray-100 bg-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
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
            每日退回趋势
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="待退回"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="已退回"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            各公司退回统计
          </h3>
          <div className="h-72 overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={400}>
              <BarChart data={companyChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                  width={80}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="待退回" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                <Bar dataKey="已退回" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            退回失败原因分布
          </h3>
          <div className="h-72">
            {reasonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                  >
                    {reasonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">暂无失败原因数据</p>
              </div>
            )}
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
                  待退回
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  已退回
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成功率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byCompany.map((stat, index) => {
                const total = stat.pending + stat.returned || 1;
                const rate = stat.returned / total * 100;

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
                    <td className="px-6 py-4 text-center font-medium text-yellow-600">{stat.pending}</td>
                    <td className="px-6 py-4 text-center font-medium text-green-600">{stat.returned}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-medium ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {(stat.successRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {byCompany.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReturnStatistics;
