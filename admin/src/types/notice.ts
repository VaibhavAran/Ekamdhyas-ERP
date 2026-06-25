export type NoticeStatus = 'draft' | 'published' | 'scheduled' | 'expired' | 'archived';

export type NoticeCategory =
  | 'general'
  | 'academic'
  | 'event'
  | 'holiday'
  | 'exam'
  | 'fee'
  | 'transport'
  | 'urgent'
  | 'other';

export type TargetAudience = 'all' | 'students' | 'teachers' | 'parents' | 'specific_class';

export interface Notice {
  id: string;
  title: string;
  description: string;
  category: NoticeCategory;
  academicYearId: string;
  boardId: string;
  classId: string;
  division: string;
  targetAudience: TargetAudience;
  attachmentUrl: string;
  attachmentName: string;
  publishDate: string;
  expiryDate: string;
  status: NoticeStatus;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NoticeForm {
  title: string;
  description: string;
  category: NoticeCategory;
  academicYearId: string;
  boardId: string;
  classId: string;
  division: string;
  targetAudience: TargetAudience;
  attachmentUrl: string;
  attachmentName: string;
  publishDate: string;
  expiryDate: string;
  status: NoticeStatus;
}

export const EMPTY_NOTICE_FORM: NoticeForm = {
  title: '',
  description: '',
  category: 'general',
  academicYearId: '',
  boardId: '',
  classId: '',
  division: '',
  targetAudience: 'all',
  attachmentUrl: '',
  attachmentName: '',
  publishDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  status: 'draft',
};

export const NOTICE_CATEGORIES: { value: NoticeCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'event', label: 'Event' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam', label: 'Exam' },
  { value: 'fee', label: 'Fee' },
  { value: 'transport', label: 'Transport' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'other', label: 'Other' },
];

export const NOTICE_STATUS_STYLES: Record<NoticeStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  expired: 'bg-rose-100 text-rose-700 border-rose-200',
  archived: 'bg-purple-100 text-purple-700 border-purple-200',
};

export const CATEGORY_STYLES: Record<NoticeCategory, string> = {
  general: 'bg-slate-100 text-slate-600',
  academic: 'bg-blue-100 text-blue-700',
  event: 'bg-amber-100 text-amber-700',
  holiday: 'bg-green-100 text-green-700',
  exam: 'bg-red-100 text-red-700',
  fee: 'bg-purple-100 text-purple-700',
  transport: 'bg-cyan-100 text-cyan-700',
  urgent: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
};
