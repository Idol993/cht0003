import React, { useState } from 'react';
import { QrCode, Search, CheckCircle, Package, MapPin, User, AlertCircle } from 'lucide-react';
import { packageApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Package as PackageType } from '../../shared/types';

const Pickup: React.FC = () => {
  const { showToast } = useToast();
  const [pickupCode, setPickupCode] = useState('');
  const [verifiedPackage, setVerifiedPackage] = useState<PackageType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleVerify = async () => {
    if (!pickupCode || pickupCode.length < 6) {
      showToast('请输入6位取件码', 'error');
      return;
    }

    setLoading(true);
    try {
      const pkg = await packageApi.verifyPickup(pickupCode);
      setVerifiedPackage(pkg);
      setShowSuccess(true);
      showToast('取件核验成功！格口已释放', 'success');

      setTimeout(() => {
        setShowSuccess(false);
        setVerifiedPackage(null);
        setPickupCode('');
      }, 3000);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanClick = () => {
    showToast('扫码功能需调用摄像头，演示环境请手动输入取件码', 'info');
  };

  const handleKeyPadClick = (key: string) => {
    if (key === 'delete') {
      setPickupCode((prev) => prev.slice(0, -1));
    } else if (key === 'clear') {
      setPickupCode('');
    } else if (pickupCode.length < 6) {
      setPickupCode((prev) => prev + key);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {showSuccess && verifiedPackage && (
        <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-2xl p-6 animate-bounce-in">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-800 mb-1">取件成功！</h3>
              <p className="text-green-700">运单号：{verifiedPackage.trackingNumber}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {verifiedPackage.lockerCode} 格口已释放
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  尾号 {verifiedPackage.phoneSuffix}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">取件核验</h2>
          <p className="text-gray-500">请输入6位取件码或扫码取件</p>
        </div>

        <div className="mb-8">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={handleKeyDown}
                placeholder="请输入取件码"
                maxLength={6}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-2xl text-center font-mono font-bold tracking-[0.5em]"
              />
            </div>
            <button
              type="button"
              onClick={handleScanClick}
              className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              <QrCode className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-2 justify-center mb-4">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-mono font-bold transition-all ${
                  pickupCode[index]
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200'
                }`}
              >
                {pickupCode[index] || ''}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400">
            请将取件码对准扫码设备，或手动输入
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeyPadClick(key)}
              className={`h-14 rounded-xl font-semibold text-xl transition-all active:scale-95 ${
                key === 'clear'
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : key === 'delete'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
              }`}
            >
              {key === 'delete' ? '←' : key === 'clear' ? '清除' : key}
            </button>
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading || pickupCode.length < 6}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              确认取件
            </>
          )}
        </button>
      </div>

      <div className="mt-6 bg-blue-50 rounded-2xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          取件须知
        </h3>
        <ul className="space-y-2 text-sm text-blue-700">
          <li>• 请仔细核对包裹信息，确认无误后再取件</li>
          <li>• 取件后请关闭格口门，以免影响其他用户使用</li>
          <li>• 如遇包裹破损或异常，请联系驿站工作人员</li>
          <li>• 超过48小时未取件将产生超时提醒，满7天将退回</li>
        </ul>
      </div>
    </div>
  );
};

export default Pickup;
