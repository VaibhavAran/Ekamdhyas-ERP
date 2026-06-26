import { FiAlertTriangle } from 'react-icons/fi';
import { BaseModal } from '../assignment/BaseModal';
import type { SystemUser } from '../../types/userManagement';

interface Props {
  user: SystemUser;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting: boolean;
}

export function DeactivateConfirmModal({ user, onConfirm, onClose, isSubmitting }: Props) {
  const isActivating = user.status === 'inactive';

  return (
    <BaseModal title={isActivating ? 'Activate Account' : 'Deactivate Account'} onClose={onClose} width="max-w-md">
      <div className="space-y-5">
        <div className={`flex items-center gap-3 rounded-xl p-4 ${isActivating ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
          <FiAlertTriangle className={`flex-shrink-0 ${isActivating ? 'text-emerald-600' : 'text-rose-600'}`} size={20} />
          <div>
            <p className={`text-sm font-semibold ${isActivating ? 'text-emerald-800' : 'text-rose-800'}`}>
              {isActivating ? 'Activate this account?' : 'Deactivate this account?'}
            </p>
            <p className={`text-xs mt-0.5 ${isActivating ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isActivating
                ? `User "${user.name}" will be able to log in again.`
                : `User "${user.name}" will not be able to log in until reactivated.`}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
              isActivating ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            {isActivating ? 'Activate Account' : 'Deactivate Account'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
