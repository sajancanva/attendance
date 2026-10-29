import { useState, useEffect } from 'react';
import { Teacher, ClassRoom, Student, AttendanceRecord, DayOfWeek } from './types';
import { AppData, loadData, saveData, generateId, getDaysOfWeek, getPeriods, getCurrentDate, getDayFromDate } from './store';
import * as XLSX from 'xlsx';

type Tab = 'dashboard' | 'teachers' | 'classes' | 'attendance' | 'register' | 'export';

function App() {
  const [data, setData] = useState<AppData>(loadData());
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getDayFromDate(getCurrentDate()));
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'present' | 'absent'>>({});
  const [notification, setNotification] = useState<string>('');

  useEffect(() => {
    saveData(data);
  }, [data]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // Mark all students as present when class/period changes
  useEffect(() => {
    if (selectedClass) {
      const cls = data.classes.find(c => c.id === selectedClass);
      if (cls) {
        const existingRecords = data.attendanceRecords.filter(
          r => r.classId === selectedClass && r.date === selectedDate && r.period === selectedPeriod
        );
        const status: Record<string, 'present' | 'absent'> = {};
        cls.students.forEach(s => {
          const existing = existingRecords.find(r => r.studentId === s.id);
          status[s.id] = existing ? existing.status : 'present';
        });
        setAttendanceStatus(status);
      }
    }
  }, [selectedClass, selectedPeriod, selectedDate]);

  const toggleStudent = (studentId: string) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const saveAttendance = () => {
    if (!selectedTeacher || !selectedClass) {
      showNotification('Please select teacher and class first!');
      return;
    }

    const newRecords: AttendanceRecord[] = [];
    Object.entries(attendanceStatus).forEach(([studentId, status]) => {
      const existingIdx = data.attendanceRecords.findIndex(
        r => r.studentId === studentId && r.date === selectedDate && r.period === selectedPeriod
      );
      
      const record: AttendanceRecord = {
        id: generateId(),
        studentId,
        classId: selectedClass,
        teacherId: selectedTeacher,
        date: selectedDate,
        day: selectedDay,
        period: selectedPeriod,
        status,
        markedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        newRecords.push(record);
      } else {
        newRecords.push(record);
      }
    });

    // Remove old records for this class/date/period and add new ones
    const filteredRecords = data.attendanceRecords.filter(
      r => !(r.classId === selectedClass && r.date === selectedDate && r.period === selectedPeriod)
    );

    setData(prev => ({
      ...prev,
      attendanceRecords: [...filteredRecords, ...newRecords]
    }));

    showNotification('✅ Attendance saved successfully!');
  };

  const markAllPresent = () => {
    if (selectedClass) {
      const cls = data.classes.find(c => c.id === selectedClass);
      if (cls) {
        const status: Record<string, 'present' | 'absent'> = {};
        cls.students.forEach(s => { status[s.id] = 'present'; });
        setAttendanceStatus(status);
      }
    }
  };

  const markAllAbsent = () => {
    if (selectedClass) {
      const cls = data.classes.find(c => c.id === selectedClass);
      if (cls) {
        const status: Record<string, 'present' | 'absent'> = {};
        cls.students.forEach(s => { status[s.id] = 'absent'; });
        setAttendanceStatus(status);
      }
    }
  };

  // Export functions
  const exportToExcel = (type: 'daily' | 'weekly' | 'full') => {
    const wsData: any[][] = [];
    
    if (type === 'daily') {
      const cls = data.classes.find(c => c.id === selectedClass);
      if (!cls) return;
      
      wsData.push(['ATTENDANCE REGISTER']);
      wsData.push([`Class: ${cls.name} - ${cls.section}`, `Date: ${selectedDate}`, `Day: ${selectedDay}`, `Period: ${selectedPeriod}`]);
      wsData.push(['']);
      wsData.push(['Roll No', 'Student Name', 'Status', 'Marked At']);
      
      cls.students.forEach(student => {
        const record = data.attendanceRecords.find(
          r => r.studentId === student.id && r.date === selectedDate && r.period === selectedPeriod
        );
        wsData.push([
          student.rollNo,
          student.name,
          record?.status.toUpperCase() || 'NOT MARKED',
          record?.markedAt ? new Date(record.markedAt).toLocaleString() : '-'
        ]);
      });
    } else if (type === 'weekly') {
      const cls = data.classes.find(c => c.id === selectedClass);
      if (!cls) return;
      const days = getDaysOfWeek();
      const periods = getPeriods();
      
      wsData.push(['WEEKLY ATTENDANCE REGISTER']);
      wsData.push([`Class: ${cls.name} - ${cls.section}`, `Week of: ${selectedDate}`]);
      wsData.push(['']);
      
      periods.forEach(period => {
        wsData.push([`PERIOD ${period.number} (${period.time})`]);
        wsData.push(['Roll No', 'Student Name', ...days.map(d => d.substring(0, 3))]);
        
        cls.students.forEach(student => {
          const row = [student.rollNo, student.name];
          days.forEach(day => {
            const record = data.attendanceRecords.find(
              r => r.studentId === student.id && r.day === day && r.period === period.number
            );
            row.push(record?.status === 'present' ? 'P' : record?.status === 'absent' ? 'A' : '-');
          });
          wsData.push(row);
        });
        wsData.push(['']);
      });
    } else {
      // Full register
      data.classes.forEach(cls => {
        wsData.push([`CLASS: ${cls.name} - ${cls.section}`]);
        wsData.push(['Roll No', 'Student Name', 'Total Present', 'Total Absent', 'Attendance %']);
        
        cls.students.forEach(student => {
          const records = data.attendanceRecords.filter(r => r.studentId === student.id);
          const present = records.filter(r => r.status === 'present').length;
          const absent = records.filter(r => r.status === 'absent').length;
          const total = present + absent;
          const pct = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : 'N/A';
          wsData.push([student.rollNo, student.name, present, absent, pct]);
        });
        wsData.push(['']);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance_Report_${type}_${selectedDate}.xlsx`);
    showNotification('📊 Excel file downloaded!');
  };

  const exportToCSV = () => {
    const cls = data.classes.find(c => c.id === selectedClass);
    if (!cls) return;
    
    let csv = 'Roll No,Student Name,Status,Date,Day,Period,Marked At\n';
    cls.students.forEach(student => {
      const records = data.attendanceRecords.filter(r => r.studentId === student.id);
      if (records.length === 0) {
        csv += `${student.rollNo},${student.name},NOT MARKED,,,,'-'\n`;
      } else {
        records.forEach(r => {
          csv += `${student.rollNo},${student.name},${r.status},${r.date},${r.day},${r.period},${new Date(r.markedAt).toLocaleString()}\n`;
        });
      }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${cls.name}_${cls.section}_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('📄 CSV file downloaded!');
  };

  // Add teacher
  const addTeacher = (name: string, email: string) => {
    const newTeacher: Teacher = { id: generateId(), name, email, classes: [] };
    setData(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
    showNotification('✅ Teacher added!');
  };

  // Add class
  const addClass = (name: string, section: string, teacherId: string) => {
    const newClass: ClassRoom = { id: generateId(), name, section, teacherId, students: [] };
    setData(prev => ({ ...prev, classes: [...prev.classes, newClass] }));
    showNotification('✅ Class added!');
  };

  // Add student
  const addStudent = (classId: string, name: string, rollNo: string) => {
    const newStudent: Student = { id: generateId(), name, rollNo, classId };
    setData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === classId ? { ...c, students: [...c.students, newStudent] } : c)
    }));
    showNotification('✅ Student added!');
  };

  // Bulk upload students via CSV
  const handleCSVUpload = (classId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const students: Student[] = [];
      
      // Skip header if it contains "name" or "roll"
      const startIdx = lines[0]?.toLowerCase().includes('name') || lines[0]?.toLowerCase().includes('roll') ? 1 : 0;
      
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 2) {
          students.push({
            id: generateId(),
            rollNo: parts[0] || String(i),
            name: parts[1],
            classId
          });
        }
      }

      setData(prev => ({
        ...prev,
        classes: prev.classes.map(c => c.id === classId ? { ...c, students: [...c.students, ...students] } : c)
      }));
      showNotification(`✅ ${students.length} students uploaded!`);
    };
    reader.readAsText(file);
  };

  // Delete student
  const deleteStudent = (classId: string, studentId: string) => {
    setData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === classId ? { ...c, students: c.students.filter(s => s.id !== studentId) } : c),
      attendanceRecords: prev.attendanceRecords.filter(r => r.studentId !== studentId)
    }));
    showNotification('Student removed!');
  };

  // Delete class
  const deleteClass = (classId: string) => {
    setData(prev => ({
      ...prev,
      classes: prev.classes.filter(c => c.id !== classId),
      attendanceRecords: prev.attendanceRecords.filter(r => r.classId !== classId)
    }));
    showNotification('Class removed!');
  };

  // Delete teacher
  const deleteTeacher = (teacherId: string) => {
    setData(prev => ({
      ...prev,
      teachers: prev.teachers.filter(t => t.id !== teacherId)
    }));
    showNotification('Teacher removed!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
          {notification}
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold">School Attendance System</h1>
                <p className="text-indigo-200 text-sm">Hourly Period-wise Attendance Management</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className="text-indigo-200">{new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {([
              { id: 'dashboard', label: '📊 Dashboard', icon: '' },
              { id: 'teachers', label: '👨‍🏫 Teachers', icon: '' },
              { id: 'classes', label: '🏫 Classes & Students', icon: '' },
              { id: 'attendance', label: '✅ Mark Attendance', icon: '' },
              { id: 'register', label: '📋 Register View', icon: '' },
              { id: 'export', label: '📥 Export', icon: '' },
            ] as { id: Tab; label: string; icon: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
                <div className="text-3xl font-bold text-blue-600">{data.teachers.length}</div>
                <div className="text-gray-600">Teachers</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-500">
                <div className="text-3xl font-bold text-green-600">{data.classes.length}</div>
                <div className="text-gray-600">Classes</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-purple-500">
                <div className="text-3xl font-bold text-purple-600">{data.classes.reduce((acc, c) => acc + c.students.length, 0)}</div>
                <div className="text-gray-600">Total Students</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-orange-500">
                <div className="text-3xl font-bold text-orange-600">{data.attendanceRecords.length}</div>
                <div className="text-gray-600">Records</div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-xl font-bold mb-4">Today's Attendance Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.classes.map(cls => {
                  const todayRecords = data.attendanceRecords.filter(r => r.classId === cls.id && r.date === getCurrentDate());
                  const present = todayRecords.filter(r => r.status === 'present').length;
                  const absent = todayRecords.filter(r => r.status === 'absent').length;
                  const total = cls.students.length;
                  return (
                    <div key={cls.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">{cls.name} - {cls.section}</span>
                        <span className="text-sm text-gray-500">{total} students</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-green-600 font-medium">✓ Present: {present}</span>
                        <span className="text-red-600 font-medium">✗ Absent: {absent}</span>
                        <span className="text-gray-500">Unmarked: {total - present - absent}</span>
                      </div>
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${total > 0 ? (present / total) * 100 : 0}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-xl font-bold mb-4">Period Schedule (7 Periods, Mon-Fri)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-indigo-50">
                      <th className="p-2 text-left">Period</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-center" colSpan={5}>Days</th>
                    </tr>
                    <tr className="bg-indigo-50">
                      <th></th><th></th>
                      {getDaysOfWeek().map(d => <th key={d} className="p-2 text-center">{d.substring(0, 3)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {getPeriods().map(p => (
                      <tr key={p.number} className="border-t">
                        <td className="p-2 font-medium">Period {p.number}</td>
                        <td className="p-2 text-gray-600">{p.time}</td>
                        {getDaysOfWeek().map(day => {
                          const count = data.attendanceRecords.filter(r => r.day === day && r.period === p.number).length;
                          return (
                            <td key={day} className="p-2 text-center">
                              {count > 0 ? (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">{count} records</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <TeachersPanel
            teachers={data.teachers}
            classes={data.classes}
            onAddTeacher={addTeacher}
            onDeleteTeacher={deleteTeacher}
          />
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <ClassesPanel
            classes={data.classes}
            teachers={data.teachers}
            onAddClass={addClass}
            onAddStudent={addStudent}
            onDeleteStudent={deleteStudent}
            onDeleteClass={deleteClass}
            onCSVUpload={handleCSVUpload}
          />
        )}

        {/* Attendance Marking Tab */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-xl font-bold mb-4">Mark Attendance</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
                  <select
                    value={selectedTeacher}
                    onChange={e => setSelectedTeacher(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Teacher</option>
                    {data.teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Class</option>
                    {data.classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => { setSelectedDate(e.target.value); setSelectedDay(getDayFromDate(e.target.value)); }}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                  <select
                    value={selectedDay}
                    onChange={e => setSelectedDay(e.target.value as DayOfWeek)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {getDaysOfWeek().map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select
                    value={selectedPeriod}
                    onChange={e => setSelectedPeriod(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {getPeriods().map(p => (
                      <option key={p.number} value={p.number}>Period {p.number} ({p.time})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto time display */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-blue-700 font-medium">
                  Current Time: {new Date().toLocaleTimeString()} | Attendance will be auto-timestamped
                </span>
              </div>
            </div>

            {selectedClass && (
              <div className="bg-white rounded-xl p-6 shadow-md">
                <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                  <h3 className="text-lg font-bold">
                    {data.classes.find(c => c.id === selectedClass)?.name} - {data.classes.find(c => c.id === selectedClass)?.section}
                    <span className="text-gray-500 font-normal text-sm ml-2">
                      ({data.classes.find(c => c.id === selectedClass)?.students.length} students)
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={markAllPresent} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">
                      ✓ All Present
                    </button>
                    <button onClick={markAllAbsent} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">
                      ✗ All Absent
                    </button>
                    <button onClick={saveAttendance} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                      💾 Save Attendance
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-3 text-left w-16">Roll</th>
                        <th className="p-3 text-left">Student Name</th>
                        <th className="p-3 text-center w-24">Status</th>
                        <th className="p-3 text-center w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classes.find(c => c.id === selectedClass)?.students.map((student, idx) => (
                        <tr key={student.id} className={`border-t transition-colors ${attendanceStatus[student.id] === 'absent' ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}>
                          <td className="p-3 font-mono text-sm">{student.rollNo}</td>
                          <td className="p-3 font-medium">{student.name}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                              attendanceStatus[student.id] === 'present'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {attendanceStatus[student.id] === 'present' ? '✓ PRESENT' : '✗ ABSENT'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleStudent(student.id)}
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                attendanceStatus[student.id] === 'present'
                                  ? 'border-green-500 bg-green-500 text-white'
                                  : 'border-red-500 bg-red-500 text-white'
                              }`}
                            >
                              {attendanceStatus[student.id] === 'present' ? '✓' : '✗'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">Present: {Object.values(attendanceStatus).filter(s => s === 'present').length}</span>
                    <span className="text-red-600 font-medium">Absent: {Object.values(attendanceStatus).filter(s => s === 'absent').length}</span>
                  </div>
                  <button onClick={saveAttendance} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-md">
                    💾 Save Attendance
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Register View */}
        {activeTab === 'register' && (
          <RegisterView data={data} selectedClass={selectedClass} setSelectedClass={setSelectedClass} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <h2 className="text-xl font-bold mb-4">Export Attendance Data</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Class</label>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">All Classes</option>
                    {data.classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                  <div className="text-4xl mb-2">📊</div>
                  <h3 className="font-bold text-lg mb-2">Daily Attendance (Excel)</h3>
                  <p className="text-gray-500 text-sm mb-4">Export attendance for selected class, date & period</p>
                  <button onClick={() => exportToExcel('daily')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Download Excel
                  </button>
                </div>
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                  <div className="text-4xl mb-2">📅</div>
                  <h3 className="font-bold text-lg mb-2">Weekly Register (Excel)</h3>
                  <p className="text-gray-500 text-sm mb-4">Full weekly attendance for all 7 periods, 5 days</p>
                  <button onClick={() => exportToExcel('weekly')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Download Excel
                  </button>
                </div>
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                  <div className="text-4xl mb-2">📋</div>
                  <h3 className="font-bold text-lg mb-2">Full Register (Excel)</h3>
                  <p className="text-gray-500 text-sm mb-4">Complete attendance summary for all classes</p>
                  <button onClick={() => exportToExcel('full')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    Download Excel
                  </button>
                </div>
                <div className="border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors">
                  <div className="text-4xl mb-2">📄</div>
                  <h3 className="font-bold text-lg mb-2">CSV Export</h3>
                  <p className="text-gray-500 text-sm mb-4">Download as CSV spreadsheet format</p>
                  <button onClick={exportToCSV} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>School Attendance Management System | 7 Periods × 5 Days | All data saved locally in browser</p>
        </div>
      </footer>
    </div>
  );
}

// Teachers Panel Component
function TeachersPanel({ teachers, classes, onAddTeacher, onDeleteTeacher }: {
  teachers: Teacher[];
  classes: ClassRoom[];
  onAddTeacher: (name: string, email: string) => void;
  onDeleteTeacher: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">Add New Teacher</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Teacher Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 min-w-[200px] border rounded-lg px-3 py-2"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 min-w-[200px] border rounded-lg px-3 py-2"
          />
          <button
            onClick={() => { if (name && email) { onAddTeacher(name, email); setName(''); setEmail(''); } }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Teacher
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">Teachers List ({teachers.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teachers.map(teacher => (
            <div key={teacher.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg">{teacher.name}</div>
                <div className="text-gray-500 text-sm">{teacher.email}</div>
                <div className="text-indigo-600 text-sm mt-1">
                  Classes: {classes.filter(c => c.teacherId === teacher.id).map(c => `${c.name}-${c.section}`).join(', ') || 'None assigned'}
                </div>
              </div>
              <button
                onClick={() => onDeleteTeacher(teacher.id)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Classes Panel Component
function ClassesPanel({ classes, teachers, onAddClass, onAddStudent, onDeleteStudent, onDeleteClass, onCSVUpload }: {
  classes: ClassRoom[];
  teachers: Teacher[];
  onAddClass: (name: string, section: string, teacherId: string) => void;
  onAddStudent: (classId: string, name: string, rollNo: string) => void;
  onDeleteStudent: (classId: string, studentId: string) => void;
  onDeleteClass: (classId: string) => void;
  onCSVUpload: (classId: string, file: File) => void;
}) {
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentRoll, setStudentRoll] = useState('');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">Add New Class</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Class Name (e.g., Class 10)"
            value={className}
            onChange={e => setClassName(e.target.value)}
            className="flex-1 min-w-[150px] border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="Section (e.g., A)"
            value={section}
            onChange={e => setSection(e.target.value)}
            className="w-32 border rounded-lg px-3 py-2"
          />
          <select
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="flex-1 min-w-[150px] border rounded-lg px-3 py-2"
          >
            <option value="">Assign Teacher</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={() => { if (className && section) { onAddClass(className, section, teacherId); setClassName(''); setSection(''); setTeacherId(''); } }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Add Class
          </button>
        </div>
      </div>

      {classes.map(cls => (
        <div key={cls.id} className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer"
            onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}>
            <div>
              <h3 className="font-bold text-lg">{cls.name} - Section {cls.section}</h3>
              <p className="text-gray-500 text-sm">
                Teacher: {teachers.find(t => t.id === cls.teacherId)?.name || 'Not assigned'} | 
                Students: {cls.students.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{expandedClass === cls.id ? '▼' : '▶'}</span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteClass(cls.id); }} className="text-red-500 hover:text-red-700 p-1">🗑️</button>
            </div>
          </div>

          {expandedClass === cls.id && (
            <div className="p-4 border-t">
              {/* Add student form */}
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Roll No"
                  value={studentRoll}
                  onChange={e => setStudentRoll(e.target.value)}
                  className="w-24 border rounded-lg px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Student Name"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="flex-1 min-w-[200px] border rounded-lg px-3 py-2"
                />
                <button
                  onClick={() => { if (studentName) { onAddStudent(cls.id, studentName, studentRoll || String(cls.students.length + 1)); setStudentName(''); setStudentRoll(''); } }}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  + Add Student
                </button>
                <label className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm cursor-pointer">
                  📤 Upload CSV
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) onCSVUpload(cls.id, e.target.files[0]); }}
                  />
                </label>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                CSV Format: RollNo,StudentName (one per line). First line can be header.
              </div>

              {/* Student list */}
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Roll No</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map(student => (
                      <tr key={student.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 font-mono">{student.rollNo}</td>
                        <td className="p-2">{student.name}</td>
                        <td className="p-2 text-center">
                          <button onClick={() => onDeleteStudent(cls.id, student.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Register View Component
function RegisterView({ data, selectedClass, setSelectedClass, selectedDate, setSelectedDate }: {
  data: AppData;
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  selectedDate: string;
  setSelectedDate: (v: string) => void;
}) {
  const [viewType, setViewType] = useState<'daily' | 'weekly'>('daily');
  const cls = data.classes.find(c => c.id === selectedClass);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-6 shadow-md">
        <h2 className="text-xl font-bold mb-4">Attendance Register</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="border rounded-lg px-3 py-2"
          >
            <option value="">Select Class</option>
            {data.classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
            ))}
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />
          <div className="flex rounded-lg overflow-hidden border">
            <button
              onClick={() => setViewType('daily')}
              className={`px-4 py-2 text-sm ${viewType === 'daily' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Daily View
            </button>
            <button
              onClick={() => setViewType('weekly')}
              className={`px-4 py-2 text-sm ${viewType === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'}`}
            >
              Weekly View
            </button>
          </div>
        </div>
      </div>

      {cls && viewType === 'daily' && (
        <div className="bg-white rounded-xl p-6 shadow-md overflow-x-auto">
          <h3 className="font-bold text-lg mb-2">
            {cls.name} - {cls.section} | {selectedDate}
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-indigo-100">
                <th className="border p-2">Roll No</th>
                <th className="border p-2">Student Name</th>
                {getPeriods().map(p => (
                  <th key={p.number} className="border p-2">P{p.number}</th>
                ))}
                <th className="border p-2">Total P</th>
                <th className="border p-2">Total A</th>
                <th className="border p-2">%</th>
              </tr>
            </thead>
            <tbody>
              {cls.students.map(student => {
                let totalP = 0, totalA = 0;
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="border p-2 font-mono">{student.rollNo}</td>
                    <td className="border p-2">{student.name}</td>
                    {getPeriods().map(p => {
                      const record = data.attendanceRecords.find(
                        r => r.studentId === student.id && r.date === selectedDate && r.period === p.number
                      );
                      if (record?.status === 'present') totalP++;
                      if (record?.status === 'absent') totalA++;
                      return (
                        <td key={p.number} className={`border p-2 text-center font-bold ${
                          record?.status === 'present' ? 'text-green-600 bg-green-50' :
                          record?.status === 'absent' ? 'text-red-600 bg-red-50' : 'text-gray-400'
                        }`}>
                          {record?.status === 'present' ? 'P' : record?.status === 'absent' ? 'A' : '-'}
                        </td>
                      );
                    })}
                    <td className="border p-2 text-center font-bold text-green-600">{totalP}</td>
                    <td className="border p-2 text-center font-bold text-red-600">{totalA}</td>
                    <td className="border p-2 text-center font-bold">{totalP + totalA > 0 ? ((totalP / (totalP + totalA)) * 100).toFixed(0) : 0}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cls && viewType === 'weekly' && (
        <div className="bg-white rounded-xl p-6 shadow-md overflow-x-auto">
          <h3 className="font-bold text-lg mb-2">
            {cls.name} - {cls.section} | Weekly View
          </h3>
          {getPeriods().map(period => (
            <div key={period.number} className="mb-6">
              <h4 className="font-bold text-indigo-700 mb-2 bg-indigo-50 p-2 rounded">
                Period {period.number} ({period.time})
              </h4>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Roll</th>
                    <th className="border p-2">Name</th>
                    {getDaysOfWeek().map(d => (
                      <th key={d} className="border p-2">{d.substring(0, 3)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cls.students.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="border p-2 font-mono">{student.rollNo}</td>
                      <td className="border p-2">{student.name}</td>
                      {getDaysOfWeek().map(day => {
                        const record = data.attendanceRecords.find(
                          r => r.studentId === student.id && r.day === day && r.period === period.number
                        );
                        return (
                          <td key={day} className={`border p-2 text-center font-bold ${
                            record?.status === 'present' ? 'text-green-600 bg-green-50' :
                            record?.status === 'absent' ? 'text-red-600 bg-red-50' : 'text-gray-400'
                          }`}>
                            {record?.status === 'present' ? 'P' : record?.status === 'absent' ? 'A' : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {!cls && (
        <div className="bg-white rounded-xl p-12 shadow-md text-center text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p>Select a class to view the attendance register</p>
        </div>
      )}
    </div>
  );
}

export default App;
