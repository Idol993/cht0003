import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle, AlertTriangle, RotateCcw, MapPin, Phone, Truck, Tag, ArrowRight, Mail, Users, Check, X, User } from 'lucide-react';
import { packageApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Package as PackageType, OperationLog, NotificationDelivery } from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const PackageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [pkg, setPkg] = useState<PackageType | null>(null);
  const [traceLogs, setTraceLogs] = useState<OperationLog[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [packageData, traceData, deliveryData] = await Promise.all([
        packageApi.getById(parseInt(id)),
        packageApi.getTrace(parseInt(id)),
        packageApi.getDeliveries(parseInt(id)),
      ]);
      setPkg(packageData);
      setTraceLogs(traceData);
      setDeliveries(deliveryData);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!pkg) return;
    
    try {
      await packageApi.claimPackage(pkg.id);
      showToast('认领成功，已获取取件码', 'success');
      setShowClaimConfirm(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleReturn = async () => {
    if (!pkg) return;
    
    try {
      await packageApi.markAsReturned(pkg.id);
      showToast('已标记为退回', 'success');
      setShowReturnConfirm(false);
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

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
      case 'expired': return '已超期';
      default: return status;
    }
  };

  const getDeliveryStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700';
      case 'blocked_conflict': return 'bg-red-100 text-red-700';
      case 'no_match': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return Check;
      case 'blocked_conflict': return X;
      case 'no_match': return Users;
      case 'failed': return X;
      default: return Clock;
    }
  };

  const getDeliveryStatusText = (status: string) => {
    switch (status) {
      case 'success': return '成功送达';
      case 'blocked_conflict': return '尾号冲突拦截';
      case 'no_match': return '未匹配到用户';
      case 'failed': return '发送失败';
      default: return status;
    }
  };

  const getDeliveryStatusBgColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'blocked_conflict': return 'bg-red-500';
      case 'no_match': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'pickup': return '取件通知';
      case 'reminder': return '超时提醒';
      case 'return': return '退回通知';
      case 'claim': return '待认领通知';
      case 'system': return '系统通知';
      default: return type;
    }
  };

  const getOperationText = (op: string) => {
    switch (op) {
      case 'store':
      case 'create': return '入库';
      case 'pickup': return '取件';
      case 'return': return '退回';
      case 'expire': return '过期';
      case 'notify': return '通知';
      case 'reminder': return '超时提醒';
      default: return op;
    }
  };

  const getDeliveryStatusText2 = (status: string) => {
    switch (status) {
      case 'pending': return '正常送达';
      case 'delivered': return '已送达';
      case 'conflict': return '尾号冲突待认领';
      case 'claimed': return '已认领';
      default: return status;
    }
  };

  const getDeliveryStatusColor2 = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-green-100 text-green-700';
      case 'delivered': return 'bg-blue-100 text-blue-700';
      case 'conflict': return 'bg-red-100 text-red-700';
      case 'claimed': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSizeText = (size?: string) => {
    switch (size) {
      case 'small': return '小';
      case 'medium': return '中';
      case 'large': return '大';
      default: return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500">包裹不存在</p>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(pkg.status);
  const isOverdue = pkg.isOverdue && pkg.status === 'pending';
  const canClaim = user?.role === 'resident' && pkg.deliveryStatus === 'conflict';
  const canReturn = (user?.role === 'courier' || user?.role === 'admin') && 
    (pkg.status === 'pending' || pkg.status === 'expired');

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-gray-600 hover:text-primary transition-colors flex items-center gap-2"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        返回列表
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{pkg.trackingNumber}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(pkg.status)}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {getStatusText(pkg.status)}
                {isOverdue && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded">
                    超{pkg.overdueDays}天
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Truck className="w-4 h-4" />
                  快递公司
                </div>
                <p className="font-medium text-gray-900">{pkg.companyName}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Phone className="w-4 h-4" />
                  手机尾号
                </div>
                <p className="font-medium text-gray-900 font-mono">{pkg.phoneSuffix}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Tag className="w-4 h-4" />
                  取件码
                </div>
                {pkg.deliveryStatus === 'conflict' && !canClaim ? (
                  <p className="font-medium text-gray-400">待认领</p>
                ) : (
                  <p className="font-mono font-bold text-xl text-primary">{pkg.pickupCode}</p>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <MapPin className="w-4 h-4" />
                  格口位置
                </div>
                <p className="font-medium text-gray-900">{pkg.lockerCode}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Package className="w-4 h-4" />
                  包裹尺寸
                </div>
                <p className="font-medium text-gray-900">{getSizeText(pkg.size)}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  入库时间
                </div>
                <p className="font-medium text-gray-900">{pkg.storedAt}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Clock className="w-4 h-4" />
                  已存放时长
                </div>
                <p className="font-medium text-gray-900">
                  {Math.floor(pkg.storageHours / 24)}天 {pkg.storageHours % 24}小时
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Mail className="w-4 h-4" />
                  通知状态
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor2(pkg.deliveryStatus)}`}>
                  {getDeliveryStatusText2(pkg.deliveryStatus)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {canClaim && (
              <button
                onClick={() => setShowClaimConfirm(true)}
                className="px-6 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-all flex items-center gap-2"
              >
                <Tag className="w-4 h-4" />
                认领包裹
              </button>
            )}
            {canReturn && (
              <button
                onClick={() => setShowReturnConfirm(true)}
                className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                确认退回
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            操作轨迹
          </h2>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            
            {traceLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无操作记录
              </div>
            ) : (
              traceLogs.map((log, index) => (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    index === 0 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{getOperationText(log.action || log.operation || '')}</p>
                      <span className="text-xs text-gray-400">{log.createdAt}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      操作员：{log.operatorName || '系统'}
                    </p>
                    {log.remark && (
                      <p className="text-sm text-gray-400 mt-1">{log.remark}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            通知投递记录
          </h2>

          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            
            {deliveries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                暂无投递记录
              </div>
            ) : (
              deliveries.map((delivery, index) => {
                const StatusIcon = getDeliveryStatusIcon(delivery.status);
                return (
                  <div key={delivery.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${getDeliveryStatusBgColor(delivery.status)}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900">{getNotificationTypeText(delivery.notificationType)}</p>
                        <span className="text-xs text-gray-400">{delivery.sentAt}</span>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDeliveryStatusColor(delivery.status)}`}>
                        {getDeliveryStatusText(delivery.status)}
                      </span>
                      {delivery.recipientName && (
                        <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          收件人：{delivery.recipientName} ({delivery.recipientPhone})
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        匹配人数：{delivery.matchedCount} 人
                      </p>
                      {delivery.remark && (
                        <p className="text-sm text-gray-400 mt-1">{delivery.remark}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showClaimConfirm}
        onClose={() => setShowClaimConfirm(false)}
        title="认领包裹"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 rounded-xl">
            <p className="text-purple-700">
              确认认领运单号 <strong className="font-mono">{pkg.trackingNumber}</strong>？
            </p>
            <p className="text-sm text-purple-500 mt-2">
              认领成功后您将获得取件码，请尽快取件。
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowClaimConfirm(false)}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleClaim}
              className="px-5 py-2.5 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-all"
            >
              确认认领
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReturnConfirm}
        onClose={() => setShowReturnConfirm(false)}
        title="确认退回"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-xl">
            <p className="text-red-700">
              确认将运单号 <strong className="font-mono">{pkg.trackingNumber}</strong> 标记为退回？
            </p>
            <p className="text-sm text-red-500 mt-2">
              此操作将通知快递员取件，包裹状态将更新为"已退回"。
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowReturnConfirm(false)}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleReturn}
              className="px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all"
            >
              确认退回
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PackageDetail;
