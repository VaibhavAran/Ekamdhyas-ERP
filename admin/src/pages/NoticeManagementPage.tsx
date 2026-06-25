import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiLoader, FiBell,
  FiFilter, FiX, FiUpload, FiFile, FiCheckCircle,
  FiAlertCircle, FiClock, FiArchive, FiSend, FiDownload,
} from 'react-icons/fi';
import {
  fetchAllNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  updateNoticeStatus,
  uploadAttachment,
  deleteAttachment,
  computeNoticeStats,
} from '../services/noticeService';
import type {
  Notice,
  NoticeForm,
  NoticeStatus,
  NoticeCategory,
  TargetAudience,
} from '../types/notice';
import {
  EMPTY_NOTICE_FORM,
  NOTICE_CATEGORIES,
  NOTICE_STATUS_STYLES,
  CATEGORY_STYLES,
} from '../types/notice';
import type { Board, ClassModel, AcademicYear } from '../types/board';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function NoticeManagementPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [form, setForm] = useState<NoticeForm>({ ...EMPTY_NOTICE_FORM });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [noticesData, boardSnap, classSnap, yearSnap] = await Promise.all([
        fetchAllNotices(),
        getDocs(collection(db, 'boards')),
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'academic_years')),
      ]);
      setNotices(noticesData);
      setBoards(boardSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Board)));
      setClasses(classSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassModel)));
      setAcademicYears(yearSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademicYear)));
    } catch (err) {
      console.error('Error fetching data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => computeNoticeStats(notices), [notices]);

  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      const matchSearch = !searchTerm || n.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchYear = !filterYear || n.academicYearId === filterYear;
      const matchBoard = !filterBoard || n.boardId === filterBoard;
      const matchStatus = !filterStatus || n.status === filterStatus;
      const matchCategory = !filterCategory || n.category === filterCategory;
      return matchSearch && matchYear && matchBoard && matchStatus && matchCategory;
    });
  }, [notices, searchTerm, filterYear, filterBoard, filterStatus, filterCategory]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.publishDate) e.publishDate = 'Publish date is required';
    if (!form.expiryDate) e.expiryDate = 'Expiry date is required';
    if (form.publishDate && form.expiryDate && form.publishDate > form.expiryDate) {
      e.expiryDate = 'Expiry date cannot be before publish date';
    }
    if (!form.academicYearId) e.academicYearId = 'Academic year is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => {
    const activeYear = academicYears.find((y) => y.isActive);
    setForm({ ...EMPTY_NOTICE_FORM, academicYearId: activeYear?.id || '' });
    setErrors({});
    setSelectedNotice(null);
    setAttachmentFile(null);
    setActiveModal('add');
  };

  const openEdit = (notice: Notice) => {
    setSelectedNotice(notice);
    setForm({
      title: notice.title,
      description: notice.description,
      category: notice.category,
      academicYearId: notice.academicYearId,
      boardId: notice.boardId,
      classId: notice.classId,
      division: notice.division,
      targetAudience: notice.targetAudience,
      attachmentUrl: notice.attachmentUrl,
      attachmentName: notice.attachmentName,
      publishDate: notice.publishDate,
      expiryDate: notice.expiryDate,
      status: notice.status,
    });
    setErrors({});
    setAttachmentFile(null);
    setActiveModal('edit');
  };

  const openView = (notice: Notice) => {
    setSelectedNotice(notice);
    setActiveModal('view');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be under 5MB', 'error');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast('Only PDF and image files are allowed', 'error');
      return;
    }
    setAttachmentFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      let attachmentUrl = form.attachmentUrl;
      let attachmentName = form.attachmentName;

      if (attachmentFile) {
        const tempId = selectedNotice?.id || Date.now().toString();
        const uploaded = await uploadAttachment(attachmentFile, tempId);
        attachmentUrl = uploaded.url;
        attachmentName = uploaded.name;
      }

      const noticeData = { ...form, attachmentUrl, attachmentName };

      if (activeModal === 'edit' && selectedNotice) {
        if (selectedNotice.attachmentName && attachmentFile && selectedNotice.attachmentName !== attachmentName) {
          await deleteAttachment(selectedNotice.id, selectedNotice.attachmentName);
        }
        await updateNotice(selectedNotice.id, noticeData);
        showToast('Notice updated successfully!', 'success');
      } else {
        await createNotice(noticeData, 'Admin');
        showToast('Notice created successfully!', 'success');
      }
      setActiveModal(null);
      fetchData();
    } catch (err: any) {
      console.error('Error saving notice:', err);
      showToast(err.message || 'Failed to save notice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (notice: Notice) => {
    if (!window.confirm(`Delete notice "${notice.title}"? This cannot be undone.`)) return;
    try {
      if (notice.attachmentName) await deleteAttachment(notice.id, notice.attachmentName);
      await deleteNotice(notice.id);
      showToast('Notice deleted!', 'success');
      fetchData();
    } catch {
      showToast('Failed to delete notice', 'error');
    }
  };

  const handleStatusChange = async (notice: Notice, newStatus: NoticeStatus) => {
    try {
      await updateNoticeStatus(notice.id, newStatus);
      showToast(`Notice ${newStatus}!`, 'success');
      fetchData();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const inputClass = (field: string) =>
    `w-full rounded-xl border bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/10 ${
      errors[field] ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
    }`;

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => !form.boardId || c.board_id === form.boardId);
  }, [classes, form.boardId]);

  const statCards = [
    { label: 'Total Notices', value: stats.total, icon: FiBell, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active', value: stats.active, icon: FiCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Scheduled', value: stats.scheduled, icon: FiClock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Expired', value: stats.expired, icon: FiAlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900/95 backdrop-blur-sm px-6 py-4 text-white shadow-2xl animate-in slide-in-from-top-5">
          {toast.type === 'success' ? <FiCheckCircle className="text-emerald-400 text-xl" /> : <FiAlertCircle className="text-red-400 text-xl" />}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Notice Management</h1>
          <p className="mt-1 text-slate-500 font-medium">Create, schedule, and manage notices for students, teachers, and parents.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-600/40"
        >
          <FiPlus className="text-lg" /> Create Notice
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}><s.icon size={22} /></div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm">
          <FiFilter className="text-blue-600" /> Filters
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notices..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Years</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select value={filterBoard} onChange={(e) => setFilterBoard(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Boards</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Categories</option>
            {NOTICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center">
          <FiLoader className="animate-spin text-3xl text-blue-600 mb-3" />
          <p className="font-semibold text-slate-500">Loading notices...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Title', 'Category', 'Published', 'Expiry', 'Audience', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                      <FiBell className="mx-auto text-3xl mb-3 text-slate-300" />
                      <p className="font-semibold">No notices found</p>
                    </td>
                  </tr>
                ) : (
                  filteredNotices.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{n.title}</div>
                        {n.attachmentName && <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><FiFile className="text-xs" /> Attachment</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${CATEGORY_STYLES[n.category]}`}>
                          {n.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{n.publishDate || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{n.expiryDate || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 capitalize">{n.targetAudience.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider border ${NOTICE_STATUS_STYLES[n.status]}`}>
                          {n.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button title="View" onClick={() => openView(n)} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                            <FiEye size={15} />
                          </button>
                          <button title="Edit" onClick={() => openEdit(n)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all">
                            <FiEdit2 size={15} />
                          </button>
                          <button title="Delete" onClick={() => handleDelete(n)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <h2 className="text-xl font-bold text-slate-900">{activeModal === 'add' ? 'Create Notice' : 'Edit Notice'}</h2>
              <button onClick={() => setActiveModal(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Title <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass('title')} placeholder="Notice title" />
                {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description <span className="text-red-500">*</span></label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputClass('description')} resize-none`}
                  rows={5}
                  placeholder="Notice description..."
                />
                {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as NoticeCategory })} className={inputClass('category')}>
                    {NOTICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target Audience</label>
                  <select value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value as TargetAudience })} className={inputClass('targetAudience')}>
                    <option value="all">All</option>
                    <option value="students">Students</option>
                    <option value="teachers">Teachers</option>
                    <option value="parents">Parents</option>
                    <option value="specific_class">Specific Class</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Academic Year <span className="text-red-500">*</span></label>
                <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })} className={inputClass('academicYearId')}>
                  <option value="">Select Year</option>
                  {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
                </select>
                {errors.academicYearId && <p className="mt-1 text-xs text-red-500">{errors.academicYearId}</p>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Board (Optional)</label>
                  <select value={form.boardId} onChange={(e) => setForm({ ...form, boardId: e.target.value, classId: '' })} className={inputClass('boardId')}>
                    <option value="">All Boards</option>
                    {boards.filter((b) => b.status === 'active').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Class (Optional)</label>
                  <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className={inputClass('classId')}>
                    <option value="">All Classes</option>
                    {filteredClasses.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}{c.division ? ` - ${c.division}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Division (Optional)</label>
                  <input type="text" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className={inputClass('division')} placeholder="e.g. A" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Publish Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} className={inputClass('publishDate')} />
                  {errors.publishDate && <p className="mt-1 text-xs text-red-500">{errors.publishDate}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Expiry Date <span className="text-red-500">*</span></label>
                  <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputClass('expiryDate')} />
                  {errors.expiryDate && <p className="mt-1 text-xs text-red-500">{errors.expiryDate}</p>}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { value: 'draft', label: 'Draft', icon: FiFile },
                    { value: 'published', label: 'Published', icon: FiSend },
                    { value: 'scheduled', label: 'Scheduled', icon: FiClock },
                    { value: 'archived', label: 'Archived', icon: FiArchive },
                  ] as const).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.value })}
                      className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                        form.status === s.value
                          ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <s.icon className="text-sm" /> {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Attachment (Optional)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                >
                  <FiUpload className="text-slate-400" />
                  <div className="flex-1">
                    {attachmentFile ? (
                      <span className="text-sm font-semibold text-slate-700">{attachmentFile.name}</span>
                    ) : form.attachmentName ? (
                      <span className="text-sm font-semibold text-slate-700">{form.attachmentName} (current)</span>
                    ) : (
                      <span className="text-sm text-slate-400">Click to upload PDF or image (max 5MB)</span>
                    )}
                  </div>
                  {(attachmentFile || form.attachmentName) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); setForm({ ...form, attachmentUrl: '', attachmentName: '' }); }}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <FiX className="text-sm" />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleFileChange} className="hidden" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setActiveModal(null)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-70">
                  {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : activeModal === 'add' ? 'Create Notice' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'view' && selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50"><FiBell className="text-blue-600" /></div>
                <h2 className="text-xl font-bold text-slate-900">Notice Details</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <FiX className="text-xl" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-bold text-slate-900">{selectedNotice.title}</h3>
                <div className="flex gap-2 shrink-0">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${NOTICE_STATUS_STYLES[selectedNotice.status]}`}>
                    {selectedNotice.status}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${CATEGORY_STYLES[selectedNotice.category]}`}>
                    {selectedNotice.category}
                  </span>
                </div>
              </div>

              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{selectedNotice.description}</div>

              {selectedNotice.attachmentUrl && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-700 mb-2">Attachment</p>
                  {selectedNotice.attachmentName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={selectedNotice.attachmentUrl} alt={selectedNotice.attachmentName} className="max-h-64 rounded-lg" />
                  ) : (
                    <a href={selectedNotice.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                      <FiDownload /> {selectedNotice.attachmentName}
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Target Audience" value={selectedNotice.targetAudience.replace('_', ' ')} />
                <InfoRow label="Academic Year" value={academicYears.find((y) => y.id === selectedNotice.academicYearId)?.name || '-'} />
                <InfoRow label="Board" value={boards.find((b) => b.id === selectedNotice.boardId)?.name || 'All'} />
                <InfoRow label="Class" value={classes.find((c) => c.id === selectedNotice.classId)?.name || 'All'} />
                <InfoRow label="Division" value={selectedNotice.division || 'All'} />
                <InfoRow label="Created By" value={selectedNotice.createdBy || 'Admin'} />
                <InfoRow label="Publish Date" value={selectedNotice.publishDate} />
                <InfoRow label="Expiry Date" value={selectedNotice.expiryDate} />
              </div>

              {selectedNotice.status === 'draft' && (
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => { handleStatusChange(selectedNotice, 'published'); setActiveModal(null); }} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
                    <FiSend /> Publish Now
                  </button>
                  <button onClick={() => { handleStatusChange(selectedNotice, 'archived'); setActiveModal(null); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    <FiArchive /> Archive
                  </button>
                </div>
              )}
              {selectedNotice.status === 'published' && (
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => { handleStatusChange(selectedNotice, 'archived'); setActiveModal(null); }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                    <FiArchive /> Archive
                  </button>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-8 py-5 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-md">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 capitalize">{value}</p>
    </div>
  );
}
