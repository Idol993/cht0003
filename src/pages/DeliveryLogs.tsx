import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, Search, Filter, CheckCircle, XCircle, AlertTriangle, Users, Package, Calendar, Clock, ArrowRight, Mail, Check, X } from 'lucide-react';
import { notificationApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { NotificationDelivery } from '../../shared/types';

const DeliveryLogs: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [logs, setLogs] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationType, setNotificationType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadLogs();
  }, [notificationType, statusFilter, startDate, endDate]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (notificationType) params.notificationType = notificationType;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const data = await notificationApi.getDeliveryLogs(params);
      setLogs(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadLogs();
  };

  const handleReset = () => {
    setNotificationType('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setSearchText('');
  };

  const filteredLogs = useMemo(() => {
    if (!searchText) return logs;
    const searchLower = searchText.toLowerCase();
    return logs.filter((log) =>
      log.trackingNumber?.toLowerCase().includes(searchLower)
    );
  }, [logs, searchText]);

  const stats = useMemo(() => [
    { label: '总投递数', value: logs.length, icon: Mail, color: 'text-blue-600 bg-blue-100' },
    { label: '成功数', value: logs.filter(l => l.status === 'success').length, icon: Check, color: 'text-green-600 bg-green-100' },
    { label: '拦截数', value: logs.filter(l => l.status === 'blocked_conflict').length, icon: X, color: 'text-red-600 bg-red-100' },
    { label: '未匹配数', value: logs.filter(l => l.status === 'no_match').length, icon: Users, color: 'text-yellow-600 bg-yellow-100' },
  ], [logs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700';
      case 'blocked_conflict': return 'bg-red-100 text-red-700';
      case 'no_match': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return CheckCircle;
      case 'blocked_conflict': return XCircle;
      case 'no_match': return AlertTriangle;
      case 'failed': return XCircle;
      default: return Clock;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return '成功';
      case 'blocked_conflict': return '尾号冲突拦截';
      case 'no_match': return '未匹配到用户';
      case 'failed': return '失败';
      default: return status;
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'pickup': return '取件通知';
      case 'reminder': return '超时提醒';
      case 'return': return '退回通知';
      case 'claim': return '待认领';
      case 'system': return '系统通知';
      default: return type;
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'pickup': return 'bg-green-100 text-green-700';
      case 'reminder': return 'bg-yellow-100 text-yellow-700';
      case 'return': return 'bg-red-100 text-red-700';
      case 'claim': return 'bg-purple-100 text-purple-700';
      case 'system': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          筛选条件
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">通知类型</label>
            <select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="">全部</option>
              <option value="pickup">取件通知</option>
              <option value="reminder">超时提醒</option>
              <option value="return">退回通知</option>
              <option value="claim">待认领</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">投递状态</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="">全部</option>
              <option value="success">成功</option>
              <option value="blocked_conflict">尾号冲突拦截</option>
              <option value="no_match">未匹配到用户</option>
              <option value="failed">失败</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              重置
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">运单号搜索</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入运单号搜索..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <MailCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无投递记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发送时间</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通知类型</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运单号</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">收件人</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">投递状态</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">匹配人数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map((log) => {
                  const StatusIcon = getStatusIcon(log.status);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{log.sentAt}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getNotificationTypeColor(log.notificationType)}`}>
                          {getNotificationTypeText(log.notificationType)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/packages/${log.packageId}`)}
                          className="font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="font-mono">{log.trackingNumber}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {log.recipientName ? (
                          <div>
                            <p className="text-gray-900 font-medium">{log.recipientName}</p>
                            <p className="text-sm text-gray-500">{log.recipientPhone}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {getStatusText(log.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <Users className="w-4 h-4 text-gray-400" />
                          {log.matchedCount} 人
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryLogs;
