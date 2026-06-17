import React, { useEffect, useState, useMemo } from 'react';
import { RotateCcw, Search, Filter, CheckCircle, AlertTriangle, Package, MapPin, Clock, CheckSquare, Square, Trash2 } from 'lucide-react';
import { packageApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Package as PackageType, Company } from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const Returns: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [minOverdueDays, setMinOverdueDays] = useState<number>(7);
  const [maxOverdueDays, setMaxOverdueDays] = useState<number>(30);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);

  const zones = ['A区', 'B区', 'C区'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadPackages();
  }, [companyFilter, zoneFilter, minOverdueDays, maxOverdueDays]);

  const loadData = async () => {
    try {
      if (user?.role !== 'resident') {
        const data = await userApi.getCompanies();
        setCompanies(data);
        if (user?.role === 'courier' && user.companyId) {
          setCompanyFilter(String(user.companyId));
        }
      }
    } catch {}
    loadPackages();
  };

  const loadPackages = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (companyFilter) params.companyId = parseInt(companyFilter);
      if (zoneFilter) params.zone = zoneFilter;
      if (minOverdueDays > 0) params.minOverdueDays = minOverdueDays;
      if (maxOverdueDays > 0) params.maxOverdueDays = maxOverdueDays;
      
      const data = await packageApi.getReturnList(params);
      setPackages(data);
      setSelectedIds([]);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadPackages();
  };

  const handleReset = () => {
    setCompanyFilter(user?.role === 'courier' && user.companyId ? String(user.companyId) : '');
    setZoneFilter('');
    setMinOverdueDays(7);
    setMaxOverdueDays(30);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === packages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(packages.map((p) => p.id));
    }
  };

  const handleSingleReturn = async () => {
    if (!selectedPackage) return;
    
    try {
      await packageApi.markAsReturned(selectedPackage.id);
      showToast('已标记为退回', 'success');
      setShowSingleConfirm(false);
      setSelectedPackage(null);
      loadPackages();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleBatchReturn = async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const result = await packageApi.processReturns({ packageIds: selectedIds });
      showToast(`成功退回 ${result.success} 个包裹，失败 ${result.failed} 个`, result.failed > 0 ? 'warning' : 'success');
      setShowBatchConfirm(false);
      loadPackages();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const stats = useMemo(() => [
    { label: '待退回总数', value: packages.length, icon: Package, color: 'text-red-600 bg-red-100' },
    { label: '超期7-14天', value: packages.filter(p => p.overdueDays >= 7 && p.overdueDays <= 14).length, icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    { label: '超期15-30天', value: packages.filter(p => p.overdueDays >= 15 && p.overdueDays <= 30).length, icon: AlertTriangle, color: 'text-orange-600 bg-orange-100' },
    { label: '超期30天以上', value: packages.filter(p => p.overdueDays > 30).length, icon: Trash2, color: 'text-red-600 bg-red-100' },
  ], [packages]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {user?.role !== 'courier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">快递公司</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="">全部快递公司</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {user?.role === 'courier' && user.companyName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">快递公司</label>
              <div className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                {user.companyName}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              超期天数：{minOverdueDays} - {maxOverdueDays} 天
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={minOverdueDays}
                onChange={(e) => setMinOverdueDays(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
              <span className="text-gray-400">至</span>
              <input
                type="number"
                value={maxOverdueDays}
                onChange={(e) => setMaxOverdueDays(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">格口区域</label>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="">全部区域</option>
              {zones.map((z) => (
                <option key={z} value={z.replace('区', '')}>{z}</option>
              ))}
            </select>
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
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : packages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无待退回包裹</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-4 text-left w-14">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-primary transition-colors"
                      >
                        {selectedIds.length === packages.length ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运单号</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递公司</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手机尾号</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">格口位置</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入库时间</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">超期天数</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleSelect(pkg.id)}
                          className="text-gray-400 hover:text-primary transition-colors"
                        >
                          {selectedIds.includes(pkg.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{pkg.trackingNumber}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{pkg.companyName}</td>
                      <td className="px-6 py-4 text-gray-600">尾号 {pkg.phoneSuffix}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          {pkg.lockerCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{pkg.storedAt}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          pkg.overdueDays >= 30 ? 'bg-red-100 text-red-700' :
                          pkg.overdueDays >= 15 ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          超{pkg.overdueDays}天
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          pkg.status === 'expired' 
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }`}>
                          {pkg.status === 'expired' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {pkg.status === 'expired' ? '已超期' : '待取件'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setShowSingleConfirm(true);
                          }}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-4 h-4" />
                          确认退回
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                已选择 <span className="font-semibold text-primary">{selectedIds.length}</span> 个包裹
              </p>
              <button
                onClick={() => setShowBatchConfirm(true)}
                disabled={selectedIds.length === 0}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  selectedIds.length > 0
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                批量确认退回
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showSingleConfirm}
        onClose={() => {
          setShowSingleConfirm(false);
          setSelectedPackage(null);
        }}
        title="确认退回"
        size="sm"
      >
        {selectedPackage && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-red-700">
                确认将运单号 <strong className="font-mono">{selectedPackage.trackingNumber}</strong> 标记为退回？
              </p>
              <p className="text-sm text-red-500 mt-2">
                此操作将通知快递员取件，包裹状态将更新为"已退回"。
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSingleConfirm(false);
                  setSelectedPackage(null);
                }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSingleReturn}
                className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all"
              >
                确认退回
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        title="批量确认退回"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-xl">
            <p className="text-red-700">
              确认将选中的 <strong>{selectedIds.length}</strong> 个包裹标记为退回？
            </p>
            <p className="text-sm text-red-500 mt-2">
              此操作将通知快递员取件，包裹状态将更新为"已退回"。
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowBatchConfirm(false)}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleBatchReturn}
              className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all"
            >
              确认批量退回
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Returns;
