import React, { useEffect, useState } from 'react';
import { Mail, Check, CheckCheck, Package, Clock, AlertTriangle, RotateCcw, Calendar } from 'lucide-react';
import { notificationApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Notification } from '../../shared/types';

const Notifications: React.FC = () => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.getList(100);
      setNotifications(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showToast('已全部标记为已读', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pickup': return Package;
      case 'reminder': return Clock;
      case 'return': return RotateCcw;
      case 'reservation': return Calendar;
      case 'system': return Mail;
      default: return Mail;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pickup': return 'bg-green-100 text-green-600';
      case 'reminder': return 'bg-yellow-100 text-yellow-600';
      case 'return': return 'bg-red-100 text-red-600';
      case 'reservation': return 'bg-blue-100 text-blue-600';
      case 'system': return 'bg-purple-100 text-purple-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'pickup': return '取件通知';
      case 'reminder': return '超时提醒';
      case 'return': return '退回通知';
      case 'reservation': return '预约通知';
      case 'system': return '系统通知';
      default: return type;
    }
  };

  const filteredNotifications = filterType
    ? notifications.filter((n) => n.type === filterType)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const typeStats = [
    { label: '全部', value: notifications.length, filter: '' },
    { label: '取件通知', value: notifications.filter(n => n.type === 'pickup').length, filter: 'pickup' },
    { label: '超时提醒', value: notifications.filter(n => n.type === 'reminder').length, filter: 'reminder' },
    { label: '退回通知', value: notifications.filter(n => n.type === 'return').length, filter: 'return' },
    { label: '预约通知', value: notifications.filter(n => n.type === 'reservation').length, filter: 'reservation' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {typeStats.map((stat) => (
            <button
              key={stat.filter}
              onClick={() => setFilterType(stat.filter)}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                filterType === stat.filter
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {stat.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                filterType === stat.filter ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {stat.value}
              </span>
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            全部已读
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无通知消息</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredNotifications.map((notification) => {
              const TypeIcon = getTypeIcon(notification.type);
              
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                >
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getTypeColor(notification.type)}`}>
                      <TypeIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                              {notification.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(notification.type)}`}>
                              {getTypeText(notification.type)}
                            </span>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-600' : 'text-gray-500'}`}>
                            {notification.content}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">{notification.createdAt}</p>
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              className="mt-2 text-xs text-primary hover:underline flex items-center gap-1 ml-auto"
                            >
                              <Check className="w-3 h-3" />
                              标记已读
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-2xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          通知规则说明
        </h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <Package className="w-4 h-4 mt-0.5 text-green-600" />
            <span><strong>取件通知：</strong>包裹入库成功后立即发送，包含取件码和存放位置</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-yellow-600" />
            <span><strong>超时提醒：</strong>超过48小时未取件，每日9:00自动发送提醒</span>
          </li>
          <li className="flex items-start gap-2">
            <RotateCcw className="w-4 h-4 mt-0.5 text-red-600" />
            <span><strong>退回通知：</strong>满7天未取件，通知快递员及收件人退回处理</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 text-blue-600" />
            <span><strong>预约通知：</strong>预约审核通过、拒绝或完成时发送通知</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Notifications;
