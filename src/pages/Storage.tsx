import React, { useState, useRef } from 'react';
import { Package, QrCode, Upload, Plus, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { packageApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Package as PackageType, Company, PackageBatchImportResponse } from '../../shared/types';
import * as XLSX from 'xlsx';

const Storage: React.FC = () => {
  const { showToast } = useToast();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastPackage, setLastPackage] = useState<PackageType | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchResult, setBatchResult] = useState<PackageBatchImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchCompanyId, setBatchCompanyId] = useState('');

  React.useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await userApi.getCompanies();
      setCompanies(data);
      if (data.length > 0) {
        setCompanyId(String(data[0].id));
        setBatchCompanyId(String(data[0].id));
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber || !phoneSuffix || !companyId) {
      showToast('请填写完整信息', 'error');
      return;
    }

    setLoading(true);
    try {
      const pkg = await packageApi.create({
        trackingNumber: trackingNumber.trim(),
        phoneSuffix,
        companyId: parseInt(companyId),
        size,
      });
      setLastPackage(pkg);
      setShowSuccess(true);
      showToast('入库成功！取件通知已发送', 'success');
      
      setTimeout(() => {
        setShowSuccess(false);
        setTrackingNumber('');
        setPhoneSuffix('');
        setSize('medium');
      }, 3000);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanClick = () => {
    showToast('扫码功能需调用摄像头，演示环境请手动输入运单号', 'info');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !batchCompanyId) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

      if (jsonData.length === 0) {
        showToast('文件中没有数据', 'error');
        return;
      }

      const trackingNumbers = jsonData
        .map((row) => {
          const val = Object.values(row)[0];
          return val ? String(val).trim() : null;
        })
        .filter(Boolean) as string[];

      if (trackingNumbers.length === 0) {
        showToast('未找到有效的运单号', 'error');
        return;
      }

      setLoading(true);
      const result = await packageApi.batchImport({
        trackingNumbers,
        companyId: parseInt(batchCompanyId),
      });

      setBatchResult(result);
      showToast(`批量导入完成：成功${result.successCount}条，失败${result.failCount}条`, 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['运单号'],
      ['SF1234567890'],
      ['YT9876543210'],
      ['ZD1122334455'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '运单号');
    XLSX.writeFile(wb, '批量入库模板.xlsx');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showSuccess && lastPackage && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 animate-bounce-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-800 mb-1">入库成功！</h3>
              <p className="text-green-700">运单号：{lastPackage.trackingNumber}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                <div className="bg-white px-4 py-2 rounded-lg">
                  <span className="text-xs text-gray-500">取件码</span>
                  <p className="text-2xl font-bold text-primary">{lastPackage.pickupCode}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg">
                  <span className="text-xs text-gray-500">存放位置</span>
                  <p className="text-2xl font-bold text-gray-900">{lastPackage.lockerCode}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg">
                  <span className="text-xs text-gray-500">收件人</span>
                  <p className="text-2xl font-bold text-gray-900">尾号{lastPackage.phoneSuffix}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">单个入库</h3>
              <p className="text-sm text-gray-500">扫码或手动录入包裹信息</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                运单号
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                    placeholder="扫码或输入运单号"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleScanClick}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                收件人手机尾号
              </label>
              <input
                type="text"
                value={phoneSuffix}
                onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="请输入4位手机尾号"
                maxLength={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-lg tracking-widest"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                快递公司
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                包裹尺寸
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'small', label: '小件', desc: '≤20cm' },
                  { value: 'medium', label: '中件', desc: '≤40cm' },
                  { value: 'large', label: '大件', desc: '>40cm' },
                ].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSize(s.value as any)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      size === s.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium">{s.label}</p>
                    <p className="text-xs opacity-70">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              {loading ? '处理中...' : '确认入库'}
              <Package className="w-5 h-5" />
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">批量入库</h3>
              <p className="text-sm text-gray-500">上传Excel文件批量导入</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                快递公司
              </label>
              <select
                value={batchCompanyId}
                onChange={(e) => setBatchCompanyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600 mb-2">
                拖拽文件到此处或
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary font-medium hover:underline ml-1"
                >
                  点击上传
                </button>
              </p>
              <p className="text-xs text-gray-400">
                支持 .xlsx, .xls, .csv 格式，第一列为运单号
              </p>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              下载导入模板
            </button>

            {batchResult && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-3">导入结果</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{batchResult.totalCount}</p>
                    <p className="text-xs text-gray-500">总条数</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{batchResult.successCount}</p>
                    <p className="text-xs text-gray-500">成功</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{batchResult.failCount}</p>
                    <p className="text-xs text-gray-500">失败</p>
                  </div>
                </div>
                {batchResult.failures && batchResult.failures.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-600 mb-1">失败详情：</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {batchResult.failures.map((f, i) => (
                        <div key={i} className="text-xs text-red-600 flex items-start gap-2">
                          <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{f.trackingNumber}: {f.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Storage;
