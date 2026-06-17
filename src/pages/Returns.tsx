import React, { useEffect, useState, useMemo } from 'react';
import {
  RotateCcw, Search, Filter, CheckCircle, AlertTriangle, Package,
  MapPin, Clock, CheckSquare, Square, Trash2, XCircle, CheckCheck,
  Info, ChevronRight, ClipboardList, FileText, BarChart3,
  Copy, Download, ArrowLeft, ArrowRight, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { packageApi, userApi, statisticsApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import {
  Package as PackageType, Company, BatchReturnResult,
  PrecheckResult, ReturnReason, RETURN_REASON_OPTIONS,
  ReturnStatsSummary, ReturnStatsByCompany
} from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const MIN_RETURN_DAYS = 7;

type TabKey = 'pending' | 'batch' | 'returned' | 'stats';

const Returns: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [returnedPackages, setReturnedPackages] = useState<PackageType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnedLoading, setReturnedLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [minOverdueDays, setMinOverdueDays] = useState<number>(MIN_RETURN_DAYS);
  const [maxOverdueDays, setMaxOverdueDays] = useState<number>(30);
  const [returnNotificationStatus, setReturnNotificationStatus] = useState<string>('all');
  const [trackingNo, setTrackingNo] = useState<string>('');

  const [returnedCompanyFilter, setReturnedCompanyFilter] = useState<string>('');
  const [returnedStartDate, setReturnedStartDate] = useState<string>('');
  const [returnedEndDate, setReturnedEndDate] = useState<string>('');
  const [returnedReasonFilter, setReturnedReasonFilter] = useState<string>('');

  const [batchStep, setBatchStep] = useState(1);
  const [trackingInput, setTrackingInput] = useState<string>('');
  const [parsingTracking, setParsingTracking] = useState(false);
  const [precheckResult, setPrecheckResult] = useState<PrecheckResult | null>(null);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [returnReason, setReturnReason] = useState<ReturnReason>('expired_7d');
  const [returnEvidence, setReturnEvidence] = useState<string>('');
  const [returnRemark, setReturnRemark] = useState<string>('');
  const [processingReturn, setProcessingReturn] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchReturnResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const [statsSummary, setStatsSummary] = useState<ReturnStatsSummary | null>(null);
  const [statsByCompany, setStatsByCompany] = useState<ReturnStatsByCompany[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const zones = ['A区', 'B区', 'C区'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingPackages();
    }
  }, [activeTab, companyFilter, zoneFilter, minOverdueDays, maxOverdueDays, returnNotificationStatus, trackingNo]);

  useEffect(() => {
    if (activeTab === 'returned') {
      loadReturnedPackages();
    }
  }, [activeTab, returnedCompanyFilter, returnedStartDate, returnedEndDate, returnedReasonFilter]);

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      if (user?.role !== 'resident') {
        const data = await userApi.getCompanies();
        setCompanies(data);
        if (user?.role === 'courier' && user.companyId) {
          setCompanyFilter(String(user.companyId));
          setReturnedCompanyFilter(String(user.companyId));
        }
      }
    } catch { }
    loadPendingPackages();
  };

  const loadPendingPackages = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (companyFilter) params.companyId = parseInt(companyFilter);
      if (zoneFilter) params.zone = zoneFilter;
      if (minOverdueDays > 0) params.minOverdueDays = minOverdueDays;
      if (maxOverdueDays > 0) params.maxOverdueDays = maxOverdueDays;
      if (returnNotificationStatus && returnNotificationStatus !== 'all') {
        params.returnNotificationStatus = returnNotificationStatus;
      }
      if (trackingNo) params.trackingNo = trackingNo;

      const data = await packageApi.getReturnList(params);
      setPackages(data);
      setSelectedIds([]);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReturnedPackages = async () => {
    setReturnedLoading(true);
    try {
      const params: any = { status: 'returned' };
      if (returnedCompanyFilter) params.companyId = parseInt(returnedCompanyFilter);
      if (returnedStartDate) params.startDate = returnedStartDate;
      if (returnedEndDate) params.endDate = returnedEndDate;

      const data = await packageApi.getReturnList(params);
      let filtered = data;
      if (returnedReasonFilter) {
        filtered = data.filter(p => p.returnReason === returnedReasonFilter);
      }
      setReturnedPackages(filtered);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setReturnedLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const [summary, byCompany] = await Promise.all([
        statisticsApi.getReturnSummary(),
        statisticsApi.getReturnByCompany(),
      ]);
      setStatsSummary(summary);
      setStatsByCompany(byCompany);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleReset = () => {
    setCompanyFilter(user?.role === 'courier' && user.companyId ? String(user.companyId) : '');
    setZoneFilter('');
    setMinOverdueDays(MIN_RETURN_DAYS);
    setMaxOverdueDays(30);
    setReturnNotificationStatus('all');
    setTrackingNo('');
  };

  const handleReturnedReset = () => {
    setReturnedCompanyFilter(user?.role === 'courier' && user.companyId ? String(user.companyId) : '');
    setReturnedStartDate('');
    setReturnedEndDate('');
    setReturnedReasonFilter('');
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

  const handleParseTracking = async () => {
    if (!trackingInput.trim()) {
      showToast('请输入运单号', 'warning');
      return;
    }
    setParsingTracking(true);
    try {
      const trackingNumbers = trackingInput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      if (trackingNumbers.length === 0) {
        showToast('请输入有效的运单号', 'warning');
        return;
      }

      const allPackages = await packageApi.getReturnList({});
      const matched = allPackages.filter(p => trackingNumbers.includes(p.trackingNumber));
      const matchedIds = matched.map(p => p.id);

      const newSelected = [...new Set([...selectedIds, ...matchedIds])];
      setSelectedIds(newSelected);

      showToast(`成功匹配 ${matched.length} 个包裹`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setParsingTracking(false);
    }
  };

  const handlePrecheck = async () => {
    if (selectedIds.length === 0) {
      showToast('请先选择包裹', 'warning');
      return;
    }
    setPrecheckLoading(true);
    try {
      const result = await packageApi.precheckReturn(selectedIds);
      setPrecheckResult(result);
      setBatchStep(2);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setPrecheckLoading(false);
    }
  };

  const handleProcessReturns = async () => {
    if (!precheckResult || precheckResult.eligibleCount === 0) {
      showToast('没有可退回的包裹', 'warning');
      return;
    }
    setProcessingReturn(true);
    try {
      const eligibleIds = precheckResult.eligible.map(item => item.id);
      const result = await packageApi.processReturns({
        packageIds: eligibleIds,
        reason: returnReason,
        evidence: returnEvidence,
        remark: returnRemark,
      });
      setBatchResult(result);
      setShowResultModal(true);

      if (result.failed > 0) {
        showToast(`批量退回完成：成功${result.success}个，失败${result.failed}个`, 'warning');
      } else {
        showToast(`批量退回完成：成功${result.success}个`, 'success');
      }

      setSelectedIds([]);
      loadPendingPackages();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setProcessingReturn(false);
    }
  };

  const handleExportResult = () => {
    if (!batchResult) return;
    const lines: string[] = [];
    lines.push('批量退回结果');
    lines.push(`成功: ${batchResult.success} 个`);
    lines.push(`失败: ${batchResult.failed} 个`);
    lines.push('');

    if (batchResult.successItems.length > 0) {
      lines.push('=== 成功列表 ===');
      batchResult.successItems.forEach(item => {
        lines.push(item.trackingNumber);
      });
      lines.push('');
    }

    if (batchResult.failedItems.length > 0) {
      lines.push('=== 失败列表 ===');
      batchResult.failedItems.forEach(item => {
        lines.push(`${item.trackingNumber || `ID:${item.id}`} - ${item.error}`);
      });
    }

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast('结果已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败，请手动复制', 'error');
    });
  };

  const resetBatchFlow = () => {
    setBatchStep(1);
    setPrecheckResult(null);
    setReturnReason('expired_7d');
    setReturnEvidence('');
    setReturnRemark('');
    setBatchResult(null);
  };

  const stats = useMemo(() => [
    { label: '待退回总数', value: packages.length, icon: Package, color: 'text-red-600 bg-red-100' },
    { label: '超期7-14天', value: packages.filter(p => p.overdueDays >= 7 && p.overdueDays <= 14).length, icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
    { label: '超期15-30天', value: packages.filter(p => p.overdueDays >= 15 && p.overdueDays <= 30).length, icon: AlertTriangle, color: 'text-orange-600 bg-orange-100' },
    { label: '超期30天以上', value: packages.filter(p => p.overdueDays > 30).length, icon: Trash2, color: 'text-red-600 bg-red-100' },
  ], [packages]);

  const tabs = [
    { key: 'pending' as TabKey, label: '待退回', icon: Clock },
    { key: 'batch' as TabKey, label: '批量退回', icon: ClipboardList },
    { key: 'returned' as TabKey, label: '已退回', icon: CheckCircle },
    { key: 'stats' as TabKey, label: '统计', icon: BarChart3 },
  ];

  const renderPendingTab = () => (
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
            <label className="block text-sm font-medium text-gray-700 mb-2">退回通知状态</label>
            <select
              value={returnNotificationStatus}
              onChange={(e) => setReturnNotificationStatus(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="all">全部</option>
              <option value="sent">已发送</option>
              <option value="not_sent">未发送</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">运单号搜索</label>
            <input
              type="text"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="请输入运单号"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              超期天数：{minOverdueDays} - {maxOverdueDays} 天
              <span className="text-xs text-red-500 ml-2">（最少{MIN_RETURN_DAYS}天可退回）</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={minOverdueDays}
                onChange={(e) => setMinOverdueDays(Math.max(MIN_RETURN_DAYS, parseInt(e.target.value) || MIN_RETURN_DAYS))}
                min={MIN_RETURN_DAYS}
                className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
              <span className="text-gray-400">至</span>
              <input
                type="number"
                value={maxOverdueDays}
                onChange={(e) => setMaxOverdueDays(Math.max(MIN_RETURN_DAYS, parseInt(e.target.value) || MIN_RETURN_DAYS))}
                min={MIN_RETURN_DAYS}
                className="w-20 px-3 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={loadPendingPackages}
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">通知状态</th>
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
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${pkg.overdueDays >= 30 ? 'bg-red-100 text-red-700' : pkg.overdueDays >= 15 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          超{pkg.overdueDays}天
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${pkg.returnNotificationSent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {pkg.returnNotificationSent ? '已发送' : '未发送'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => navigate(`/packages/${pkg.id}`)}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-all flex items-center gap-1.5"
                        >
                          <FileText className="w-4 h-4" />
                          查看详情
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
                onClick={() => setActiveTab('batch')}
                disabled={selectedIds.length === 0}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${selectedIds.length > 0 ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <CheckCircle className="w-4 h-4" />
                去批量退回
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderBatchTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            批量退回流程
          </h3>
          <button
            onClick={resetBatchFlow}
            className="text-sm text-gray-500 hover:text-primary transition-colors"
          >
            重置流程
          </button>
        </div>

        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${batchStep >= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step}
                </div>
                <span className={`text-xs mt-2 ${batchStep >= step ? 'text-primary font-medium' : 'text-gray-400'}`}>
                  {step === 1 ? '选择包裹' : step === 2 ? '预检' : step === 3 ? '填写信息' : '确认处理'}
                </span>
              </div>
              {index < 3 && (
                <div className={`flex-1 h-0.5 mx-2 ${batchStep > step ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {batchStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">方式A：从列表勾选</h4>
                <p className="text-sm text-gray-500">已从"待退回"列表中选择 <span className="font-semibold text-primary">{selectedIds.length}</span> 个包裹</p>
                <button
                  onClick={() => setActiveTab('pending')}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  前往待退回页面选择
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">方式B：粘贴运单号</h4>
                <textarea
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="每行一个运单号..."
                  className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                />
                <button
                  onClick={handleParseTracking}
                  disabled={parsingTracking}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {parsingTracking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  解析运单号
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={handlePrecheck}
                disabled={selectedIds.length === 0 || precheckLoading}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${selectedIds.length > 0 ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                {precheckLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                开始预检
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {batchStep === 2 && precheckResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-green-50 rounded-2xl p-5 border border-green-200">
                <h4 className="font-medium text-green-900 flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  可退回（{precheckResult.eligibleCount}件）
                </h4>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {precheckResult.eligible.map((item) => (
                    <div key={item.id} className="bg-white rounded-lg p-3 border border-green-100">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium text-gray-900">{item.trackingNumber}</span>
                        <span className="text-xs text-green-600">可退回</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.companyName} · {item.lockerCode} · 超{item.overdueDays}天
                      </div>
                    </div>
                  ))}
                  {precheckResult.eligible.length === 0 && (
                    <p className="text-sm text-green-700/60 text-center py-8">暂无可退回包裹</p>
                  )}
                </div>
              </div>

              <div className="bg-red-50 rounded-2xl p-5 border border-red-200">
                <h4 className="font-medium text-red-900 flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5" />
                  不可退回（{precheckResult.ineligibleCount}件）
                </h4>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {precheckResult.ineligible.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-red-100">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {item.trackingNumber || `ID: ${item.id}`}
                        </span>
                        <span className="text-xs text-red-600">不可退回</span>
                      </div>
                      <p className="text-xs text-red-500 mt-1">{item.error}</p>
                    </div>
                  ))}
                  {precheckResult.ineligible.length === 0 && (
                    <p className="text-sm text-red-700/60 text-center py-8">全部都可退回</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => setBatchStep(1)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                上一步
              </button>
              <button
                onClick={() => setBatchStep(3)}
                disabled={precheckResult.eligibleCount === 0}
                className={`px-6 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${precheckResult.eligibleCount > 0 ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {batchStep === 3 && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">退回原因</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                {RETURN_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">退回凭证（URL）</label>
              <input
                type="text"
                value={returnEvidence}
                onChange={(e) => setReturnEvidence(e.target.value)}
                placeholder="请输入凭证图片或文档URL"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">备注</label>
              <textarea
                value={returnRemark}
                onChange={(e) => setReturnRemark(e.target.value)}
                placeholder="请输入备注信息..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => setBatchStep(2)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                上一步
              </button>
              <button
                onClick={() => setBatchStep(4)}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {batchStep === 4 && precheckResult && (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-200">
              <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-4">
                <Info className="w-5 h-5" />
                确认退回信息
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex">
                  <span className="text-blue-700 w-24">可退回数量：</span>
                  <span className="font-medium text-blue-900">{precheckResult.eligibleCount} 件</span>
                </div>
                <div className="flex">
                  <span className="text-blue-700 w-24">退回原因：</span>
                  <span className="font-medium text-blue-900">
                    {RETURN_REASON_OPTIONS.find(o => o.value === returnReason)?.label}
                  </span>
                </div>
                {returnEvidence && (
                  <div className="flex">
                    <span className="text-blue-700 w-24">退回凭证：</span>
                    <span className="font-medium text-blue-900 break-all">{returnEvidence}</span>
                  </div>
                )}
                {returnRemark && (
                  <div className="flex">
                    <span className="text-blue-700 w-24">备注：</span>
                    <span className="font-medium text-blue-900">{returnRemark}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-100">
              <button
                onClick={() => setBatchStep(3)}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                上一步
              </button>
              <button
                onClick={handleProcessReturns}
                disabled={processingReturn}
                className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {processingReturn && <Loader2 className="w-4 h-4 animate-spin" />}
                确认退回
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-2xl p-5">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          退回规则说明
        </h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <span>存放满 <strong>7天</strong> 未取件的包裹才允许退回处理</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <span>已被系统标记为 <strong>"已超期"(expired)</strong> 的包裹可直接退回</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <span>快递员仅可退回 <strong>本公司</strong> 范围内的包裹</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
            <span>未满7天、已取件、已退回状态的包裹 <strong>不可退回</strong></span>
          </li>
        </ul>
      </div>
    </div>
  );

  const renderReturnedTab = () => (
    <div className="space-y-6">
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
                value={returnedCompanyFilter}
                onChange={(e) => setReturnedCompanyFilter(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
            <input
              type="date"
              value={returnedStartDate}
              onChange={(e) => setReturnedStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
            <input
              type="date"
              value={returnedEndDate}
              onChange={(e) => setReturnedEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">退回原因</label>
            <select
              value={returnedReasonFilter}
              onChange={(e) => setReturnedReasonFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="">全部原因</option>
              {RETURN_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={loadReturnedPackages}
              className="flex-1 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              查询
            </button>
            <button
              onClick={handleReturnedReset}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {returnedLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : returnedPackages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无已退回记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">运单号</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递公司</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">格口位置</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入库时间</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">退回时间</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">退回原因</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">退回人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {returnedPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/packages/${pkg.id}`)}
                        className="font-medium text-primary hover:underline"
                      >
                        {pkg.trackingNumber}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{pkg.companyName}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {pkg.lockerCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{pkg.storedAt}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{pkg.returnedAt || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {RETURN_REASON_OPTIONS.find(o => o.value === pkg.returnReason)?.label || pkg.returnReason || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{pkg.returnedByName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="space-y-6">
      {statsLoading ? (
        <div className="p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : statsSummary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-yellow-600 bg-yellow-100">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">待退回总数</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.totalPending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-green-600 bg-green-100">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">已退回总数</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.totalReturned}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 bg-blue-100">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">批量退回成功率</p>
                  <p className="text-2xl font-bold text-gray-900">{(statsSummary.batchSuccessRate * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 bg-purple-100">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">批量退回总数</p>
                  <p className="text-2xl font-bold text-gray-900">{statsSummary.batchTotal}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                各公司退回统计
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">快递公司</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">待退回</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">已退回</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">成功率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {statsByCompany.map((stat, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{stat.companyName}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-yellow-600">{stat.pending}</td>
                      <td className="px-6 py-4 text-center font-medium text-green-600">{stat.returned}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-medium text-primary">{(stat.successRate * 100).toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/statistics/return')}
              className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all inline-flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              查看完整统计
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-2">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === tab.key ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'pending' && renderPendingTab()}
      {activeTab === 'batch' && renderBatchTab()}
      {activeTab === 'returned' && renderReturnedTab()}
      {activeTab === 'stats' && renderStatsTab()}

      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="批量退回结果"
        size="lg"
      >
        {batchResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-green-700">{batchResult.success}</p>
                <p className="text-sm text-green-600">成功退回</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl text-center">
                <XCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-bold text-red-700">{batchResult.failed}</p>
                <p className="text-sm text-red-600">处理失败</p>
              </div>
            </div>

            {batchResult.successItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-green-600" />
                  成功列表
                </h4>
                <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 space-y-1">
                  {batchResult.successItems.map((item) => (
                    <div key={item.id} className="text-sm text-gray-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="font-mono">{item.trackingNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {batchResult.failedItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  失败列表
                </h4>
                <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-xl p-3 space-y-2">
                  {batchResult.failedItems.map((item) => (
                    <div key={item.id} className="text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="font-mono font-medium text-red-700">
                          {item.trackingNumber || `包裹ID: ${item.id}`}
                        </span>
                      </div>
                      <p className="text-red-600 text-xs pl-6">{item.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={handleExportResult}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                导出结果
              </button>
              <button
                onClick={() => setShowResultModal(false)}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
              >
                确定
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Returns;
