import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
} from 'lucide-react';
import { getNotificationsForStudent } from '../lib/firebaseService';
import type { NotificationItem } from '../types';

interface NotificationCenterProps {
  userId: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<'all' | 'teacher' | 'admin'>('all');

  // Load notifications from Firestore on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const notifs = await getNotificationsForStudent(userId);
        if (mounted) setNotifications(notifs as NotificationItem[]);
      } catch (e) {
        console.error('Error loading notifications', e);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    setNotifications(updated);
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleToggleRead = (id: string) => {
    const updated = notifications.map(n => 
      n.id === id ? { ...n, isRead: !n.isRead } : n
    );
    setNotifications(updated);
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.role === activeTab;
  });

  return (
    <div className="relative text-left">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-3.5 rounded-2xl border transition-all duration-300 ${
          isOpen 
            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
            : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600 shadow-sm'
        }`}
        id="notification-bell-btn"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Overlay Container */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-outside backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 mt-3 w-96 bg-white border border-gray-100 rounded-[32px] shadow-2xl z-50 overflow-hidden flex flex-col max-h-[580px]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-tr from-gray-50 to-white">
                <div>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">Notification Hub</h3>
                  <p className="text-xs text-gray-400 font-medium">Updates from PES College authorities</p>
                </div>
                {notifications.length > 0 && (
                  <div className="flex gap-1">
                    <button 
                      onClick={handleMarkAllRead}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-4.5 w-4.5" />
                    </button>
                    <button 
                      onClick={handleClearAll}
                      className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                      title="Clear notifications"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Filtering tab bar */}
              <div className="flex p-2 bg-gray-50 border-b border-gray-100 gap-1 font-medium">
                {(['all', 'teacher', 'admin'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl capitalize transition-all duration-200 ${
                      activeTab === tab
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'all' ? 'All Updates' : `${tab}s`}
                  </button>
                ))}
              </div>

              {/* List container */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 min-h-[180px] max-h-[300px]">
                {filteredNotifs.length > 0 ? (
                  filteredNotifs.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleToggleRead(notif.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group flex gap-3 ${
                        notif.isRead 
                          ? 'bg-white border-gray-50 hover:bg-gray-50/50' 
                          : 'bg-blue-50/40 border-blue-100/50 hover:bg-blue-50/70'
                      }`}
                    >
                      {/* Read status light */}
                      {!notif.isRead && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                      )}

                      {/* Role icon badge */}
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        notif.role === 'admin' 
                          ? 'bg-purple-100 text-purple-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {notif.role === 'admin' ? 'Ad' : 'Te'}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {notif.sender}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-900 leading-snug">
                          {notif.title}
                        </h4>
                        <p className="text-xs text-gray-500 leading-relaxed font-normal">
                          {notif.message}
                        </p>
                        <span className="block text-[9px] font-semibold text-gray-400 pt-1">
                          {notif.timestamp}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400 italic text-xs font-medium">
                    No notifications in this feed.
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
