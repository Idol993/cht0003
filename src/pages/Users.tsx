import React, { useEffect, useState } from 'react';
import { Users as UsersIcon, Plus, Edit, UserX, UserCheck, Search, Shield, Truck, Home, Building } from 'lucide-react';
import { userApi } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { User, Company } from '../../shared/types';

const UsersPage: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    role: 'resident',
    companyId: '',
    status: 'active',
  });
  const [companyForm, setCompanyForm] = useState({ name: '', code: '' });

  useEffect(() => {
    loadData();
  }, [roleFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, companiesData] = await Promise.all([
        userApi.getList(roleFilter || undefined),
        userApi.getCompanies(),
      ]);
      setUsers(usersData);
      setCompanies(companiesData);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.phone || !formData.name || !formData.role) {
      showToast('请填写完整信息', 'error');
      return;
    }

    if (formData.role === 'courier' && !formData.companyId) {
      showToast('快递员必须绑定快递公司', 'error');
      return;
    }

    try {
      await userApi.create({
        ...formData,
        companyId: formData.companyId ? parseInt(formData.companyId) : undefined,
      });
      showToast('用户创建成功', 'success');
      setShowAddModal(false);
      setFormData({ phone: '', name: '', role: 'resident', companyId: '', status: 'active' });
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleEdit = async () => {
    if (!formData.phone || !formData.name || !formData.role || !selectedUser) return;

    try {
      await userApi.update(selectedUser.id, {
        ...formData,
        companyId: formData.companyId ? parseInt(formData.companyId) : undefined,
      });
      showToast('用户更新成功', 'success');
      setShowEditModal(false);
      setSelectedUser(null);
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (!confirm(`确认${user.status === 'active' ? '禁用' : '启用'}该用户？`)) return;
    
    try {
      await userApi.toggleStatus(user.id);
      showToast(`用户已${user.status === 'active' ? '禁用' : '启用'}`, 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleAddCompany = async () => {
    if (!companyForm.name || !companyForm.code) {
      showToast('请填写完整信息', 'error');
      return;
    }

    try {
      await userApi.createCompany(companyForm);
      showToast('快递公司创建成功', 'success');
      setShowCompanyModal(false);
      setCompanyForm({ name: '', code: '' });
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      phone: user.phone,
      name: user.name,
      role: user.role,
      companyId: user.companyId ? String(user.companyId) : '',
      status: user.status,
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter((user) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.phone.includes(searchText)
    );
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'courier': return Truck;
      case 'resident': return Home;
      default: return UsersIcon;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return '管理员';
      case 'courier': return '快递员';
      case 'resident': return '居民';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700';
      case 'courier': return 'bg-blue-100 text-blue-700';
      case 'resident': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const roleStats = [
    { label: '全部', value: users.length, filter: '' },
    { label: '管理员', value: users.filter(u => u.role === 'admin').length, filter: 'admin' },
    { label: '快递员', value: users.filter(u => u.role === 'courier').length, filter: 'courier' },
    { label: '居民', value: users.filter(u => u.role === 'resident').length, filter: 'resident' },
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
          {roleStats.map((stat) => (
            <button
              key={stat.filter}
              onClick={() => setRoleFilter(stat.filter)}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                roleFilter === stat.filter
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {stat.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                roleFilter === stat.filter ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {stat.value}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCompanyModal(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <Building className="w-4 h-4" />
            快递公司
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增用户
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索用户姓名或手机号..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">暂无用户记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用户信息
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    手机号
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    所属公司
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => {
                  const RoleIcon = getRoleIcon(user.role);
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center text-white font-semibold">
                            {user.name?.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{user.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          {getRoleText(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{user.companyName || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status === 'active' ? '正常' : '禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{user.createdAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.status === 'active'
                                ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                                : 'text-gray-500 hover:text-green-500 hover:bg-green-50'
                            }`}
                            title={user.status === 'active' ? '禁用' : '启用'}
                          >
                            {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
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

      {companies.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              快递公司列表
            </h3>
            <span className="text-sm text-gray-500">共 {companies.length} 家</span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="p-3 bg-gray-50 rounded-xl text-center hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{company.name}</p>
                  <p className="text-xs text-gray-500">{company.code}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="新增用户"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="请输入姓名"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
              placeholder="请输入手机号"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">角色</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value, companyId: '' })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
            >
              <option value="resident">居民</option>
              <option value="courier">快递员</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          {formData.role === 'courier' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">所属快递公司</label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="">请选择快递公司</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
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
        title="编辑用户"
        size="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">角色</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, companyId: '' })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="resident">居民</option>
                <option value="courier">快递员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            {formData.role === 'courier' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">所属快递公司</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                >
                  <option value="">请选择快递公司</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
              >
                <option value="active">正常</option>
                <option value="inactive">禁用</option>
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

      <Modal
        isOpen={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        title="新增快递公司"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">公司名称</label>
            <input
              type="text"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              placeholder="如：顺丰速运"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">公司编码</label>
            <input
              type="text"
              value={companyForm.code}
              onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value.toUpperCase() })}
              placeholder="如：SF"
              maxLength={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowCompanyModal(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleAddCompany}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
            >
              确认添加
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UsersPage;
