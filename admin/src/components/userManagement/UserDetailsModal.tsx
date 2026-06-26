import { useState } from 'react';
import { FiUser, FiMail, FiPhone, FiShield, FiCalendar, FiClock, FiBook, FiCheckCircle } from 'react-icons/fi';
import { BaseModal } from '../assignment/BaseModal';
import type { SystemUser } from '../../types/userManagement';
import { USER_ROLE_STYLES, USER_STATUS_STYLES } from '../../types/userManagement';

interface Props {
  user: SystemUser;
  onClose: () => void;
}

export function UserDetailsModal({ user, onClose }: Props) {
  const createdDate = user.createdAt?.toDate
    ? user.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  return (
    <BaseModal title="User Details" onClose={onClose} width="max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${USER_ROLE_STYLES[user.role]}`}>
                <FiShield className="mr-1" size={12} />
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${USER_STATUS_STYLES[user.status]}`}>
                <FiCheckCircle className="mr-1" size={12} />
                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiUser className="mt-0.5 text-blue-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{user.username || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <FiMail className="mt-0.5 text-emerald-500" size={18} />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{user.email || 'N/A'}</p>
            </div>
          </div>
          {user.phone && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <FiPhone className="mt-0.5 text-amber-500" size={18} />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{user.phone}</p>
              </div>
            </div>
          )}
          {user.employeeId && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <FiShield className="mt-0.5 text-purple-500" size={18} />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee ID</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{user.employeeId}</p>
              </div>
            </div>
          )}
          {user.className && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <FiBook className="mt-0.5 text-cyan-500" size={18} />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{user.role === 'student' ? 'Class' : 'Assigned Classes'}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{user.className}</p>
              </div>
            </div>
          )}
          {user.department && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <FiBook className="mt-0.5 text-rose-500" size={18} />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subjects</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{user.department}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FiCalendar size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Created Date</p>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">{createdDate}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <FiClock size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">Last Login</p>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Account Activity</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Source Collection</span>
              <span className="font-medium text-slate-900 capitalize">{user.collection}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Account Status</span>
              <span className={`font-medium ${user.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Force Password Change</span>
              <span className="font-medium text-slate-900">No (placeholder)</span>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
