import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle, Package, User, Phone } from 'lucide-react';
import { reservationApi, lockerApi, userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Reservation, Locker, Company } from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const Reservations: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formData, setFormData] = useState({
    itemName: '',
    size: 'large' as 'medium' | 'large',
    expectedDate: '',
    phone: '',
    remark: '',
  });
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [actionLockerId, setActionLockerId] = useState('');
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resData, lockerData] = await Promise.all([
        reservationApi.getList(statusFilter || undefined),
        lockerApi.getList().catch(() => []),
      ]);
      setReservations(resData);
      setLockers(lockerData.filter(l => l.status === 'available'));
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.itemName || !formData.expectedDate) {
      showToast('请填写完整信息', 'error');
      return;
    }

    try {
      await reservationApi.create(formData);
      showToast('预约提交成功', 'success');
      setShowAddModal(false);
      setFormData({
        itemName: '',
        size: 'large',
        expectedDate: '',
        phone: user?.phone || '',
        remark: '',
      });
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleAction = async () => {
    if (!selectedReservation) return;

    try {
      if (actionType === 'approve') {
        await reservationApi.approve(
          selectedReservation.id,
          actionLockerId ? parseInt(actionLockerId) : undefined
        );
        showToast('预约已通过', 'success');
      } else if (actionType === 'reject') {
        await reservationApi.reject(selectedReservation.id, actionReason);
        showToast('预约已拒绝', 'success');
      } else if (actionType === 'complete') {
        await reservationApi.complete(selectedReservation.id);
        showToast('预约已完成', 'success');
      }
      setShowActionModal(false);
      setSelectedReservation(null);
      setActionLockerId('');
      setActionReason('');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm('确认取消该预约？')) return;
    
    try {
      await reservationApi.cancel(id);
      showToast('预约已取消', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const openActionModal = (reservation: Reservation, type: 'approve' | 'reject' | 'complete') => {
    setSelectedReservation(reservation);
    setActionType(type);
    setShowActionModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待审核';
      case 'approved': return '已通过';
      case 'rejected': return '已拒绝';
      case 'cancelled': return '已取消';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const getSizeText = (size: string) => {
    switch (size) {
      case 'medium': return '中件';
      case 'large': return '大件';
      default: return size;
    }
  };

  const stats = [
    { label: '全部', value: reservations.length, filter: '' },
    { label: '待审核', value: reservations.filter(r => r.status === 'pending').length, filter: 'pending' },
    { label: '已通过', value: reservations.filter(r => r.status === 'approved').length, filter: 'approved' },
    { label: '已完成', value: reservations.filter(r => r.status === 'completed').length, filter: 'completed' },
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
          {stats.map((stat) => (
            <button
              key={stat.filter}
              onClick={() => setStatusFilter(stat.filter)}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                statusFilter === stat.filter
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {stat.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                statusFilter === stat.filter ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {stat.value}
              </span>
            </button>
          ))}
        </div>
        {user?.role === 'resident' && (
          <button
            onClick={() => {
              setFormData({ ...formData, phone: user.phone || '' });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            预约寄存
          </button>
        )}
      </div>

      <div className="space-y-4">
        {reservations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无预约记录</p>
          </div>
        ) : (
          reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{reservation.itemName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(reservation.status)}`}>
                      {getStatusText(reservation.status)}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {getSizeText(reservation.size)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <User className="w-4 h-4" />
                      {reservation.residentName}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="w-4 h-4" />
                      {reservation.phone}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      预计 {reservation.expectedDate}
                    </div>
                    {reservation.lockerCode && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Package className="w-4 h-4" />
                        格口 {reservation.lockerCode}
                      </div>
                    )}
                  </div>

                  {reservation.remark && (
                    <p className="mt-3 text-sm text-gray-500">备注：{reservation.remark}</p>
                  )}
                  
                  {reservation.rejectReason && (
                    <p className="mt-3 text-sm text-red-500">拒绝原因：{reservation.rejectReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {reservation.status === 'pending' && user?.role === 'resident' && (
                    <button
                      onClick={() => handleCancel(reservation.id)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  )}
                  
                  {reservation.status === 'pending' && user?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => openActionModal(reservation, 'approve')}
                        className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        通过
                      </button>
                      <button
                        onClick={() => openActionModal(reservation, 'reject')}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        拒绝
                      </button>
                    </>
                  )}
                  
                  {reservation.status === 'approved' && user?.role === 'admin' && (
                    <button
                      onClick={() => openActionModal(reservation, 'complete')}
                      className="px-3 py-1.5 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      完成
                    </button>
                  )}
                  
                  {reservation.status === 'approved' && user?.role === 'resident' && (
                    <button
                      onClick={() => handleCancel(reservation.id)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="预约大件寄存"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">物品名称</label>
            <input
              type="text"
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              placeholder="如：婴儿车、行李箱等"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">物品尺寸</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, size: 'medium' })}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  formData.size === 'medium'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">中件</p>
                <p className="text-xs opacity-70">≤40cm</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, size: 'large' })}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  formData.size === 'large'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">大件</p>
                <p className="text-xs opacity-70">{'>40cm'}</p>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">预计送达日期</label>
            <input
              type="date"
              value={formData.expectedDate}
              onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">联系电话</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="请输入联系电话"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">备注说明</label>
            <textarea
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              placeholder="其他需要说明的信息"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
            >
              提交预约
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title={
          actionType === 'approve' ? '通过预约' :
          actionType === 'reject' ? '拒绝预约' :
          '完成预约'
        }
        size="sm"
      >
        {selectedReservation && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="font-medium text-gray-900">{selectedReservation.itemName}</p>
              <p className="text-sm text-gray-500">{selectedReservation.residentName} · {selectedReservation.phone}</p>
            </div>

            {actionType === 'approve' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分配格口（可选）
                </label>
                <select
                  value={actionLockerId}
                  onChange={(e) => setActionLockerId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                >
                  <option value="">自动分配</option>
                  {lockers.filter(l => l.size === selectedReservation.size).map((l) => (
                    <option key={l.id} value={l.id}>{l.code} ({l.zone}区)</option>
                  ))}
                </select>
              </div>
            )}

            {actionType === 'reject' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  拒绝原因
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="请说明拒绝原因"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowActionModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all ${
                  actionType === 'reject' ? 'bg-red-500' : 'bg-primary'
                }`}
              >
                {actionType === 'approve' ? '确认通过' :
                 actionType === 'reject' ? '确认拒绝' :
                 '确认完成'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reservations;
