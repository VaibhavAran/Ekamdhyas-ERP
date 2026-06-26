import { useState } from 'react';
import { FiLock, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import { BaseModal } from '../assignment/BaseModal';
import type { SystemUser } from '../../types/userManagement';

interface Props {
  user: SystemUser;
  onConfirm: (newPassword: string) => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function ResetPasswordModal({ user, onConfirm, onClose, isSubmitting }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [useGenerated, setUseGenerated] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    setUseGenerated(true);
  };

  const handleSubmit = () => {
    if (newPassword.length < 6) return;
    onConfirm(newPassword);
  };

  return (
    <BaseModal title="Reset Password" onClose={onClose} width="max-w-md">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <FiAlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-amber-800">Password Reset</p>
            <p className="text-xs text-amber-600 mt-0.5">
              This will set a new password for <strong>{user.name}</strong>. The user will need to use this new password to log in.
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            New Password <span className="ml-0.5 text-red-500">*</span>
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setUseGenerated(false); }}
              placeholder="Enter new password (min 6 chars)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          {newPassword.length > 0 && newPassword.length < 6 && (
            <p className="mt-1 text-xs text-red-500">Password must be at least 6 characters</p>
          )}
        </div>

        <button
          onClick={generatePassword}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <FiRefreshCw size={16} />
          Generate Temporary Password
        </button>

        {useGenerated && newPassword && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Generated Password:</p>
            <code className="text-sm font-mono text-blue-900 break-all">{newPassword}</code>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || newPassword.length < 6}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <FiLock size={16} />
            )}
            Reset Password
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
