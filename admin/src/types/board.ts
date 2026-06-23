export interface Board {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: unknown;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassModel {
  id: string;
  name: string;
  board_id: string;
  board_name: string;
  division?: string;
  class_teacher_id?: string;
  class_teacher_name?: string;
  capacity?: number;
  status: 'active' | 'inactive';
  created_at?: unknown;
}

export interface Student {
  uid: string;
  name: string;
  roll_no: string;
  email: string;
  branch_id: string;
  branch_name: string;
  class_id: string;
  class_name: string;
  batch_id?: string;
  batch_name?: string;
  board_id?: string;
  board_name?: string;
  academic_year_id?: string;
  role: string;
  status: 'active' | 'inactive';
  created_at: unknown;
}
