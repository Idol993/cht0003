import React, { useEffect, useState } from 'react';
import {
  Package,
  Inbox,
  QrCode,
  Calendar,
  BarChart3,
  Users,
  Settings,
  Bell,
  LogOut,
  Home,
  MapPin,
  Mail,
  RotateCcw,
  MailCheck,
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationApi } from '../utils/api';
import { Notification } from '../../shared/types';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const [list, unread] = await Promise.all([
        notificationApi.getList({ limit: 10 }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(unread.count);
    } catch {}
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const getRoleMenu = () => {
    const baseMenu = [
      { path: '/', icon: Home, label: '首页' },
    ];

    if (user?.role === 'resident') {
      return [
        ...baseMenu,
        { path: '/packages', icon: Package, label: '我的包裹' },
        { path: '/reservations', icon: Calendar, label: '预约寄存' },
        { path: '/notifications', icon: Mail, label: '消息通知' },
      ];
    }

    if (user?.role === 'courier') {
      return [
        ...baseMenu,
        { path: '/packages/storage', icon: Inbox, label: '入库管理' },
        { path: '/packages', icon: Package, label: '包裹查询' },
        { path: '/packages/returns', icon: RotateCcw, label: '退回处理' },
        { path: '/lockers', icon: MapPin, label: '格口状态' },
        { path: '/notifications', icon: Mail, label: '消息通知' },
      ];
    }

    if (user?.role === 'admin') {
      return [
        ...baseMenu,
        { path: '/packages/storage', icon: Inbox, label: '入库管理' },
        { path: '/packages', icon: Package, label: '包裹管理' },
        { path: '/packages/returns', icon: RotateCcw, label: '退回处理' },
        { path: '/pickup', icon: QrCode, label: '取件核验' },
        { path: '/reservations', icon: Calendar, label: '预约管理' },
        { path: '/lockers', icon: MapPin, label: '格口管理' },
        { path: '/statistics', icon: BarChart3, label: '数据统计' },
        { path: '/users', icon: Users, label: '用户管理' },
        { path: '/notifications', icon: Mail, label: '消息通知' },
        { path: '/notifications/deliveries', icon: MailCheck, label: '投递记录' },
      ];
    }

    return baseMenu;
  };

  const menuItems = getRoleMenu();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pickup': return '📦';
      case 'reminder': return '⏰';
      case 'return': return '↩️';
      case 'reservation': return '📅';
      case 'system': return '📢';
      default: return '📩';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">快递驿站</h1>
              <p className="text-xs text-gray-500">智能代收系统</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {menuItems.find((m) => m.path === location.pathname)?.label || '首页'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">消息通知</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-sm text-primary hover:underline"
                      >
                        全部已读
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>暂无通知</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleMarkAsRead(notification.id)}
                          className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex gap-3">
                            <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {notification.content}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {notification.createdAt}
                              </p>
                            </div>
                            {!notification.read && (
                              <span className="w-2 h-2 bg-primary rounded-full mt-2" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'resident' && '居民'}
                  {user?.role === 'courier' && '快递员'}
                  {user?.role === 'admin' && '管理员'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
