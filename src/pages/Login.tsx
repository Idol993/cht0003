import React, { useState } from 'react';
import { Package, Phone, Lock, ArrowRight, UserPlus, Shield, Truck, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useToast } from '../components/Toast';
import { UserRole } from '../../shared/types';

const Login: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<UserRole>('resident');
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { login, loading, error } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const roleOptions: { value: UserRole; label: string; icon: any; desc: string }[] = [
    { value: 'resident', label: '居民', icon: Home, desc: '查看包裹/预约存放' },
    { value: 'courier', label: '快递员', icon: Truck, desc: '入库/批量导入' },
    { value: 'admin', label: '管理员', icon: Shield, desc: '全局管理/统计' },
  ];

  const demoAccounts: { role: UserRole; phone: string; label: string }[] = [
    { role: 'admin', phone: '13800000000', label: '管理员' },
    { role: 'courier', phone: '13800000003', label: '顺丰快递员' },
    { role: 'resident', phone: '13800000001', label: '居民张三' },
  ];

  const handleSendCode = async () => {
    if (!/^1\d{10}$/.test(phone)) {
      showToast('请输入正确的手机号', 'error');
      return;
    }

    setSendingCode(true);
    try {
      await fetch('/api/auth/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      showToast('验证码已发送，演示验证码：123456', 'success');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      showToast(e.message || '发送失败', 'error');
    } finally {
      setSendingCode(false);
    }
  };

  const handleDemoClick = (account: typeof demoAccounts[0]) => {
    setRole(account.role);
    setPhone(account.phone);
    setCode('123456');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !code || !role) {
      showToast('请填写完整信息（手机号、验证码、角色）', 'error');
      return;
    }

    try {
      await login({ phone, code, role });
      showToast('登录成功', 'success');
      navigate('/');
    } catch (e: any) {
      showToast(e.message || '登录失败', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Package className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">快递驿站</h1>
          <p className="text-white/80">智能代收与取件通知系统</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来</h2>
          <p className="text-gray-500 mb-8">请登录以继续使用系统</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                选择身份
              </label>
              <div className="grid grid-cols-3 gap-3">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRole(opt.value)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        role === opt.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-sm font-medium">{opt.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                手机号
              </label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入手机号"
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                验证码
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="请输入验证码 (演示: 123456)"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode || countdown > 0}
                  className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium whitespace-nowrap hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中' : '获取验证码'}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              {loading ? '登录中...' : '登录'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700 font-medium mb-3">
              <UserPlus className="w-4 h-4 inline mr-1" />
              演示账号（点击一键填充）
            </p>
            <div className="space-y-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.phone}
                  type="button"
                  onClick={() => handleDemoClick(acc)}
                  className="w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100/50 px-3 py-2 rounded-lg transition-all"
                >
                  • {acc.label}：{acc.phone} / 123456
                </button>
              ))}
            </div>
            <p className="text-xs text-blue-500 mt-3 pt-3 border-t border-blue-100">
              居民用户输入任意有效手机号 + 验证码123456即可自动注册
            </p>
          </div>
        </div>

        <p className="text-center text-white/60 text-sm mt-6">
          © 2024 小区快递代收系统 · 安全便捷高效
        </p>
      </div>
    </div>
  );
};

export default Login;
