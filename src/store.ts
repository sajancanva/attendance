import { Teacher, ClassRoom, Student, AttendanceRecord, DayOfWeek } from './types';

const STORAGE_KEY = 'attendance_app_data';

export interface AppData {
  teachers: Teacher[];
  classes: ClassRoom[];
  attendanceRecords: AttendanceRecord[];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getDefaultData(): AppData {
  const teachers: Teacher[] = [
    { id: 't1', name: 'Mrs. Sharma', email: 'sharma@school.com', classes: ['c1', 'c2'] },
    { id: 't2', name: 'Mr. Patel', email: 'patel@school.com', classes: ['c3', 'c4'] },
    { id: 't3', name: 'Ms. Gupta', email: 'gupta@school.com', classes: ['c1', 'c3'] },
    { id: 't4', name: 'Mr. Singh', email: 'singh@school.com', classes: ['c2', 'c4'] },
  ];

  const classes: ClassRoom[] = [
    {
      id: 'c1', name: 'Class 10', section: 'A', teacherId: 't1',
      students: generateStudents('c1', 20)
    },
    {
      id: 'c2', name: 'Class 10', section: 'B', teacherId: 't1',
      students: generateStudents('c2', 18)
    },
    {
      id: 'c3', name: 'Class 9', section: 'A', teacherId: 't2',
      students: generateStudents('c3', 22)
    },
    {
      id: 'c4', name: 'Class 9', section: 'B', teacherId: 't2',
      students: generateStudents('c4', 20)
    },
  ];

  return { teachers, classes, attendanceRecords: [] };
}

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aanya', 'Aadhya', 'Ira', 'Ahana', 'Kiara', 'Pari',
  'Rohan', 'Karan', 'Rahul', 'Priya', 'Neha', 'Riya', 'Ankit', 'Deepak', 'Sanjay', 'Meera'];

function generateStudents(classId: string, count: number): Student[] {
  const students: Student[] = [];
  for (let i = 0; i < count; i++) {
    students.push({
      id: `${classId}_s${i + 1}`,
      name: firstNames[i % firstNames.length] + ' ' + String.fromCharCode(65 + (i % 26)),
      rollNo: String(i + 1).padStart(3, '0'),
      classId
    });
  }
  return students;
}

export function loadData(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
  const defaultData = getDefaultData();
  saveData(defaultData);
  return defaultData;
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving data:', e);
  }
}

export function getDaysOfWeek(): DayOfWeek[] {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
}

export function getPeriods(): { number: number; time: string }[] {
  return [
    { number: 1, time: '8:00 - 8:45' },
    { number: 2, time: '8:45 - 9:30' },
    { number: 3, time: '9:30 - 10:15' },
    { number: 4, time: '10:15 - 11:00' },
    { number: 5, time: '11:15 - 12:00' },
    { number: 6, time: '12:00 - 12:45' },
    { number: 7, time: '12:45 - 1:30' },
  ];
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getDayFromDate(dateStr: string): DayOfWeek {
  const date = new Date(dateStr);
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return days[dayIndex] || 'Monday';
}

export function getCurrentDate(): string {
  return formatDate(new Date());
}
