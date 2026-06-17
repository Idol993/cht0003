import React, { useEffect, useState } from 'react';
import { Package, Search, Filter, Clock, CheckCircle, AlertTriangle, RotateCcw, Eye, ArrowRight } from 'lucide-react';
import { packageApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Package as PackageType, Company, OperationLog } from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const Packages: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [traceLogs, setTraceLogs] = useState<OperationLog[]>([]);
  const [showTraceModal, setShowTraceModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPackages();
  }, [statusFilter, companyFilter, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      if (user?.role !== 'resident') {
        const data = await userApi.getCompanies();
        setCompanies(data);
      }
    } catch {}
    loadPackages();
  };

  const loadPackages = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (companyFilter) params.companyId = parseInt(companyFilter);
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      
      const data = await packageApi.getList(Object.keys(params).length ? params : undefined);
      setPackages(data);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPackages();
  };

  const handleViewTrace = async (pkg: PackageType) => {
    try {
      const logs = await packageApi.getTrace(pkg.id);
      setSelectedPackage(pkg);
      setTraceLogs(logs);
      setShowTraceModal(true);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleReturn = async (pkg: PackageType) => {
    if (!confirm(`确认将运单号 ${pkg.trackingNumber} 标记为退回？`)) return;
    
    try {
      await packageApi.markAsReturned(pkg.id);
      showToast('已标记为退回', 'success');
      loadPackages();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      pkg.trackingNumber.toLowerCase().includes(searchLower) ||
      pkg.phoneSuffix.includes(searchText) ||
      pkg.pickupCode?.includes(searchText)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'picked': return 'bg-green-100 text-green-700 border-green-200';
      case 'returned': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock;
      case 'picked': return CheckCircle;
      case 'returned': return RotateCcw;
      case 'expired': return AlertTriangle;
      default: return Clock;
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

  const getOperationText = (op: string) => {
    switch (op) {
      case 'create': return '入库';
      case 'pickup': return '取件';
      case 'return': return '退回';
      case 'expire': return '过期';
      case 'notify': return '通知';
      case 'reminder': return '超时提醒';
      default: return op;
    }
  };

  const stats = [
    { label: '全部', value: packages.length, filter: '' },
    { label: '待取件', value: packages.filter(p => p.status === 'pending').length, filter: 'pending' },
    { label: '已取件', value: packages.filter(p => p.status === 'picked').length, filter: 'picked' },
    { label: '已退回', value: packages.filter(p => p.status === 'returned').length, filter: 'returned' },
    { label: '已过期', value: packages.filter(p => p.status === 'expired').length, filter: 'expired' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 p-4 bg-white rounded-2xl border border-gray-100">
        {stats.map((stat) => (
          <button
            key={stat.filter}
            onClick={() => setStatusFilter(stat.filter)}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
              statusFilter === stat.filter
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {stat.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              statusFilter === stat.filter ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {stat.value}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索运单号、手机尾号、取件码..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          
          {user?.role !== 'resident' && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="">全部快递公司</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
          />
          
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            查询
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无包裹记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运单号</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">收件人</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递公司</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">取件码</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">格口</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入库时间</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPackages.map((pkg) => {
                  const StatusIcon = getStatusIcon(pkg.status);
                  const isOverdue = pkg.isOverdue && pkg.status === 'pending';
                  
                  return (
                    <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{pkg.trackingNumber}</span>
                        {pkg.size && (
                          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                            {pkg.size === 'small' ? '小' : pkg.size === 'medium' ? '中' : '大'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">尾号 {pkg.phoneSuffix}</td>
                      <td className="px-6 py-4 text-gray-600">{pkg.companyName}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-lg text-primary">{pkg.pickupCode}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{pkg.lockerCode}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pkg.status)}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {getStatusText(pkg.status)}
                          {isOverdue && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded">
                              超{pkg.overdueDays}天
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{pkg.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewTrace(pkg)}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="查看轨迹"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {pkg.status === 'pending' && user?.role === 'admin' && (
                            <button
                              onClick={() => handleReturn(pkg)}
                              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="标记退回"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showTraceModal}
        onClose={() => setShowTraceModal(false)}
        title="包裹轨迹"
        size="md"
      >
        {selectedPackage && (
          <div>
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{selectedPackage.trackingNumber}</p>
                  <p className="text-sm text-gray-500">尾号 {selectedPackage.phoneSuffix} · {selectedPackage.companyName}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPackage.status)}`}>
                  {getStatusText(selectedPackage.status)}
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              
              {traceLogs.map((log, index) => (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    index === 0 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{getOperationText(log.operation)}</p>
                      <span className="text-xs text-gray-400">{log.createdAt}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      操作员：{log.operatorName}
                    </p>
                    {log.remark && (
                      <p className="text-sm text-gray-400 mt-1">{log.remark}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Packages;
