import { useState, useEffect, useMemo } from 'react';
import {
  FiSearch, FiEye, FiLock, FiLoader, FiUsers, FiShield,
  FiCheckCircle, FiXCircle, FiUserCheck, FiUserX,
} from 'react-icons/fi';
import type { SystemUser, UserRole, UserAccountStatus } from '../types/userManagement';
import { USER_ROLE_STYLES, USER_STATUS_STYLES } from '../types/userManagement';
import {
  fetchAllUsers,
  updateUserStatus,
  resetUserPassword,
  computeUserStats,
} from '../services/userManagementService';
import { Toast } from '../components/assignment';
import {
  UserDetailsModal,
  ResetPasswordModal,
  DeactivateConfirmModal,
} from '../components/userManagement';

type ModalType = 'view' | 'resetPassword' | 'deactivate' | null;

export function UserManagementPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<UserAccountStatus | ''>('');

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load users.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
      const matchesRole = !filterRole || u.role === filterRole;
      const matchesStatus = !filterStatus || u.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  const stats = useMemo(() => computeUserStats(users), [users]);

  const openViewModal = (user: SystemUser) => {
    setSelectedUser(user);
    setActiveModal('view');
  };

  const openResetPasswordModal = (user: SystemUser) => {
    setSelectedUser(user);
    setActiveModal('resetPassword');
  };

  const openDeactivateModal = (user: SystemUser) => {
    setSelectedUser(user);
    setActiveModal('deactivate');
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await resetUserPassword(selectedUser.collection, selectedUser.id, newPassword);
      showToast(`Password reset for ${selectedUser.name} successfully.`, 'success');
      setActiveModal(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to reset password.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      const newStatus: UserAccountStatus = selectedUser.status === 'active' ? 'inactive' : 'active';
      await updateUserStatus(selectedUser.collection, selectedUser.id, newStatus);
      showToast(`Account ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully.`, 'success');
      setActiveModal(null);
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast('Failed to update account status.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const summaryCards = [
    { label: 'Total Users', value: stats.total, icon: FiUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Admins', value: stats.admins, icon: FiShield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Teachers', value: stats.teachers, icon: FiUserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Students', value: stats.students, icon: FiUsers, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Active', value: stats.active, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inactive', value: stats.inactive, icon: FiUserX, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <FiLoader className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="mt-1 text-sm text-slate-500">Manage all system users across admin, teacher, and student accounts</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}>
                <s.icon size={20} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, or email..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | '')}
              className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as UserAccountStatus | '')}
              className="rounded-lg border border-slate-200 bg-slate-50 py-2 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Username / Email', 'Role', 'Status', 'Last Login', 'Source', 'Actions'].map((h) => (
                  <th key={h} className="py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <FiUsers className="mx-auto mb-2 text-3xl" />
                    <p className="font-medium">No users found</p>
                    <p className="mt-1 text-sm">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={`${user.collection}-${user.id}`} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="text-sm text-slate-900">{user.username || '-'}</p>
                        {user.email && user.email !== user.username && (
                          <p className="text-xs text-slate-500">{user.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${USER_ROLE_STYLES[user.role]}`}>
                        <FiShield size={12} />
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${USER_STATUS_STYLES[user.status]}`}>
                        {user.status === 'active' ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-600">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : <span className="text-slate-400">Never</span>
                      }
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500 capitalize">{user.collection}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openViewModal(user)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="View Details"
                        >
                          <FiEye size={16} />
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(user)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                          title="Reset Password"
                        >
                          <FiLock size={16} />
                        </button>
                        <button
                          onClick={() => openDeactivateModal(user)}
                          className={`rounded-lg p-2 transition-colors ${
                            user.status === 'active'
                              ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                              : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {user.status === 'active' ? <FiUserX size={16} /> : <FiUserCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {activeModal === 'view' && selectedUser && (
        <UserDetailsModal user={selectedUser} onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'resetPassword' && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onConfirm={handleResetPassword}
          onClose={() => setActiveModal(null)}
          isSubmitting={isSubmitting}
        />
      )}

      {activeModal === 'deactivate' && selectedUser && (
        <DeactivateConfirmModal
          user={selectedUser}
          onConfirm={handleToggleStatus}
          onClose={() => setActiveModal(null)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
