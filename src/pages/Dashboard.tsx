import React, { useEffect, useState } from 'react';
import { Package, Inbox, CheckCircle, Clock, AlertTriangle, TrendingUp, Users, MapPin } from 'lucide-react';
import { statisticsApi, packageApi, lockerApi } from '../utils/api';
import { StatisticsSummary, Package as PackageType, Locker, TrendData } from '../../shared/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuthStore } from '../stores/useAuthStore';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [recentPackages, setRecentPackages] = useState<PackageType[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryData, trendData, packagesData, lockersData] = await Promise.all([
        statisticsApi.getSummary(),
        statisticsApi.getTrend(7),
        packageApi.getList().catch(() => []),
        lockerApi.getList().catch(() => []),
      ]);
      setSummary(summaryData);
      setTrend(trendData);
      setRecentPackages(packagesData.slice(0, 5));
      setLockers(lockersData);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'picked': return 'bg-green-100 text-green-700';
      case 'returned': return 'bg-gray-100 text-gray-700';
      case 'expired': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待取件';
      case 'picked': return '已取件';
      case 'returned': return '已退回';
      case 'expired': return '已过期';
      default: return status;
    }
  };

  const getSizeText = (size: string) => {
    switch (size) {
      case 'small': return '小';
      case 'medium': return '中';
      case 'large': return '大';
      default: return size;
    }
  };

  const occupiedLockers = lockers.filter(l => l.status === 'occupied').length;
  const availableLockers = lockers.filter(l => l.status === 'available').length;
  const maintenanceLockers = lockers.filter(l => l.status === 'maintenance').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statsCards = user?.role === 'resident' ? [
    {
      title: '待取包裹',
      value: summary?.pendingCount || 0,
      icon: Package,
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-500',
    },
    {
      title: '已取包裹',
      value: summary?.pickedCount || 0,
      icon: CheckCircle,
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      title: '今日新增',
      value: summary?.todayInbound || 0,
      icon: TrendingUp,
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
  ] : [
    {
      title: '今日入库',
      value: summary?.todayInbound || 0,
      icon: Inbox,
      color: 'from-blue-400 to-indigo-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      title: '今日取件',
      value: summary?.todayOutbound || 0,
      icon: CheckCircle,
      color: 'from-green-400 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-500',
    },
    {
      title: '待取件数',
      value: summary?.pendingCount || 0,
      icon: Clock,
      color: 'from-yellow-400 to-orange-500',
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-500',
    },
    {
      title: '超期包裹',
      value: summary?.overdueCount || 0,
      icon: AlertTriangle,
      color: 'from-red-400 to-rose-500',
      bgColor: 'bg-red-50',
      iconColor: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <div
            key={index}
            className={`${stat.bgColor} rounded-2xl p-6 border border-gray-100 bg-white hover:shadow-lg transition-all`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            {summary && index === 2 && (
              <p className="text-xs text-gray-400 mt-2">
                取件率：{summary.pickupRate.toFixed(1)}%
              </p>
            )}
          </div>
        ))}
      </div>

      {user?.role !== 'resident' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">近7日入库/取件趋势</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
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
            <h3 className="font-semibold text-gray-900 mb-4">格口使用情况</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: '可用', value: availableLockers, color: '#10b981' },
                    { name: '占用', value: occupiedLockers, color: '#f59e0b' },
                    { name: '维修', value: maintenanceLockers, color: '#6b7280' },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {[
                      { name: '可用', value: availableLockers, color: '#10b981' },
                      { name: '占用', value: occupiedLockers, color: '#f59e0b' },
                      { name: '维修', value: maintenanceLockers, color: '#6b7280' },
                    ].map((entry, index) => (
                      <rect key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">最近包裹</h3>
            <span className="text-sm text-gray-500">共 {recentPackages.length} 条</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recentPackages.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>暂无包裹记录</p>
              </div>
            ) : (
              recentPackages.map((pkg) => (
                <div key={pkg.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pkg.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        <Package className={`w-5 h-5 ${pkg.status === 'pending' ? 'text-yellow-500' : 'text-green-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{pkg.trackingNumber}</p>
                        <p className="text-sm text-gray-500">尾号 {pkg.phoneSuffix} · {pkg.companyName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(pkg.status)}`}>
                        {getStatusText(pkg.status)}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{pkg.createdAt}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">格口状态</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" /> 可用
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> 占用
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400" /> 维修
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {lockers.slice(0, 14).map((locker) => (
                <div
                  key={locker.id}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-medium transition-all hover:scale-105 ${
                    locker.status === 'available'
                      ? 'bg-green-50 text-green-600 border-2 border-green-200'
                      : locker.status === 'occupied'
                      ? 'bg-yellow-50 text-yellow-600 border-2 border-yellow-200'
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }`}
                >
                  <span>{locker.code}</span>
                  <span className="text-[10px] opacity-70">{getSizeText(locker.size)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">使用率</span>
                <span className="font-medium text-gray-900">
                  {lockers.length > 0 ? ((occupiedLockers / lockers.length) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full transition-all"
                  style={{ width: `${lockers.length > 0 ? (occupiedLockers / lockers.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
