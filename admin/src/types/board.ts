export interface Board {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  academicYearId: string;
  createdAt: unknown;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Student {
  uid: string;
  name: string;
  roll_no: string;
  email: string;
  class_id: string;
  class_name: string;
  department_id: string;
  department_name: string;
  batch_id?: string;
  batch_name?: string;
  board_id?: string;
  board_name?: string;
  academic_year_id?: string;
  role: string;
  status: 'active' | 'inactive';
  created_at: unknown;
}
