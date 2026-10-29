export interface Teacher {
  id: string;
  name: string;
  email: string;
  classes: string[]; // class IDs assigned to this teacher
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  classId: string;
}

export interface ClassRoom {
  id: string;
  name: string; // e.g., "Class 10-A"
  section: string;
  teacherId: string;
  students: Student[];
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  day: DayOfWeek;
  period: number; // 1-7
  status: 'present' | 'absent';
  markedAt: string; // ISO timestamp
}

export interface AttendanceState {
  teachers: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
  selectedTeacher: string | null;
  selectedClass: string | null;
  selectedDate: string;
  selectedDay: DayOfWeek;
  selectedPeriod: number;
}
