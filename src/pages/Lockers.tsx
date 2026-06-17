import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Edit, Search, Filter } from 'lucide-react';
import { lockerApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Locker } from '../../shared/types';
import { useAuthStore } from '../stores/useAuthStore';

const Lockers: React.FC = () => {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [formData, setFormData] = useState({ code: '', zone: 'A', size: 'medium' });
  const [filterZone, setFilterZone] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSize, setFilterSize] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lockersData, statsData] = await Promise.all([
        lockerApi.getList(),
        lockerApi.getStats(),
      ]);
      setLockers(lockersData);
      setStats(statsData);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.code) {
      showToast('请输入格口编号', 'error');
      return;
    }

    try {
      await lockerApi.create(formData);
      showToast('格口创建成功', 'success');
      setShowAddModal(false);
      setFormData({ code: '', zone: 'A', size: 'medium' });
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleEdit = async () => {
    if (!formData.code || !selectedLocker) return;

    try {
      await lockerApi.update(selectedLocker.id, formData as any);
      showToast('格口更新成功', 'success');
      setShowEditModal(false);
      setSelectedLocker(null);
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const openEditModal = (locker: Locker) => {
    setSelectedLocker(locker);
    setFormData({
      code: locker.code,
      zone: locker.zone,
      size: locker.size,
    });
    setShowEditModal(true);
  };

  const filteredLockers = lockers.filter((locker) => {
    if (filterZone && locker.zone !== filterZone) return false;
    if (filterStatus && locker.status !== filterStatus) return false;
    if (filterSize && locker.size !== filterSize) return false;
    return true;
  });

  const zones = Array.from(new Set(lockers.map((l) => l.zone))).sort();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700 border-green-200';
      case 'occupied': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'maintenance': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return '可用';
      case 'occupied': return '占用';
      case 'maintenance': return '维修中';
      default: return status;
    }
  };

  const getSizeText = (size: string) => {
    switch (size) {
      case 'small': return '小';
      case 'medium': return '中';
      case 'large': return '大';
      default: return size;
    }
  };

  const getSizeLabel = (size: string) => {
    switch (size) {
      case 'small': return '小件 ≤20cm';
      case 'medium': return '中件 ≤40cm';
      case 'large': return '大件 >40cm';
      default: return size;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">总格口</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.available}</p>
                <p className="text-sm text-gray-500">可用</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.occupied}</p>
                <p className="text-sm text-gray-500">占用</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.maintenance}</p>
                <p className="text-sm text-gray-500">维修中</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
            >
              <option value="">全部区域</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}区</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
            >
              <option value="">全部状态</option>
              <option value="available">可用</option>
              <option value="occupied">占用</option>
              <option value="maintenance">维修中</option>
            </select>
            <select
              value={filterSize}
              onChange={(e) => setFilterSize(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
            >
              <option value="">全部尺寸</option>
              <option value="small">小件</option>
              <option value="medium">中件</option>
              <option value="large">大件</option>
            </select>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新增格口
            </button>
          )}
        </div>
      </div>

      {zones.map((zone) => {
        const zoneLockers = filteredLockers.filter((l) => l.zone === zone);
        if (zoneLockers.length === 0) return null;

        return (
          <div key={zone} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {zone}区格口
                <span className="text-sm font-normal text-gray-500">
                  （共 {zoneLockers.length} 个）
                </span>
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
                {zoneLockers.map((locker) => (
                  <div
                    key={locker.id}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-medium border-2 transition-all cursor-pointer hover:scale-105 ${
                      locker.status === 'available'
                        ? 'bg-green-50 text-green-600 border-green-200 hover:border-green-400'
                        : locker.status === 'occupied'
                        ? 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:border-yellow-400'
                        : 'bg-gray-100 text-gray-400 border-gray-200'
                    }`}
                    onClick={() => user?.role === 'admin' && openEditModal(locker)}
                    title={user?.role === 'admin' ? '点击编辑' : undefined}
                  >
                    <span className="text-sm font-bold">{locker.code}</span>
                    <span className="text-[10px] opacity-70">{getSizeText(locker.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {filteredLockers.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">没有找到符合条件的格口</p>
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="新增格口"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">格口编号</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="如：A01"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所属区域</label>
            <select
              value={formData.zone}
              onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="A">A区</option>
              <option value="B">B区</option>
              <option value="C">C区</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">格口尺寸</label>
            <select
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="small">{getSizeLabel('small')}</option>
              <option value="medium">{getSizeLabel('medium')}</option>
              <option value="large">{getSizeLabel('large')}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
            >
              确认添加
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="编辑格口"
        size="sm"
      >
        {selectedLocker && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">格口编号</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">所属区域</label>
              <select
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="A">A区</option>
                <option value="B">B区</option>
                <option value="C">C区</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">格口尺寸</label>
              <select
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="small">{getSizeLabel('small')}</option>
                <option value="medium">{getSizeLabel('medium')}</option>
                <option value="large">{getSizeLabel('large')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
              <select
                value={(formData as any).status || selectedLocker.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value } as any)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="available">可用</option>
                <option value="occupied">占用</option>
                <option value="maintenance">维修中</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleEdit}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
              >
                保存修改
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Lockers;
