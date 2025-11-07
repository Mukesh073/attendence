import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DatePicker from 'react-datepicker'; 
import "react-datepicker/dist/react-datepicker.css"; 
import './App.css'; 

// --- ⭐ 1. API URLs ---
const API_URL_BASE = import.meta.env.VITE_API_URL;
const SUMMARY_API_URL = `${import.meta.env.VITE_API_URL}?sheet=Summary`;

// --- ⭐ 2. Helper Functions (No Change) ---
const FESTIVAL_HOLIDAYS = [
  '2025-10-20',
  '2025-12-25',
  '2026-01-26',
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const isHoliday = (dateObj) => {
  const dateString = formatDate(dateObj);
  if (dateObj.getDay() === 0) return true; // Sunday
  if (FESTIVAL_HOLIDAYS.includes(dateString)) return true; // Festival
  return false;
};

function parseTime(timeStr) {
  if (!timeStr) return null;
  if (typeof timeStr === 'string' && timeStr.length <= 8 && timeStr.includes(':')) {
     const [h, m, s] = timeStr.split(':');
     const date = new Date(0);
     date.setHours(h, m, s || 0, 0);
     return date;
  }
  try {
    const parsedDate = new Date(timeStr);
    if (isNaN(parsedDate.getTime())) return null;
    const timeOnlyDate = new Date(0);
    timeOnlyDate.setUTCHours(parsedDate.getUTCHours(), parsedDate.getUTCMinutes(), parsedDate.getUTCSeconds(), 0);
    return timeOnlyDate;
  } catch (e) {
    return null;
  }
}

function formatISOTimeString(timeStr) {
  if (!timeStr) return '—';
  try {
    const dateObj = new Date(timeStr);
    if (isNaN(dateObj.getTime())) return '—';
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    const s = String(dateObj.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch (e) {
    return '—'; 
  }
}

// (Helper function - No Change)
// Yeh totalHours=0 aur isCheckedIn=true return karega (jo sahi hai)
function processRowData(row) {
  let totalWorkMilliseconds = 0;
  let firstCheckIn = null; 
  let lastCheckOut = null; 
  let lastActionWasCheckIn = false;
  const maxPairs = 10; 

  for (let i = 1; i <= maxPairs; i++) {
    const inKey = 'Check-in ' + i;
    const outKey = 'Check-out ' + i;
    const checkInTime = parseTime(row[inKey]); 
    const checkOutTime = parseTime(row[outKey]); 

    if (checkInTime) {
      if (!firstCheckIn) { firstCheckIn = row[inKey]; }
      lastActionWasCheckIn = true;
    }
    if (checkOutTime) {
      lastCheckOut = row[outKey]; 
      lastActionWasCheckIn = false;
    }
    if (checkInTime && checkOutTime && checkOutTime.getTime() > checkInTime.getTime()) {
      totalWorkMilliseconds += (checkOutTime.getTime() - checkInTime.getTime());
    }
  }
  const totalHours = Math.max(0, totalWorkMilliseconds / (1000 * 60 * 60));
  const isCheckedIn = lastActionWasCheckIn; 
  
  return { totalHours, firstCheckIn, lastCheckOut, isCheckedIn };
}


// --- ⭐ 3. Mukhya EmployeePage Component ---

function EmployeePage() {
  const [employeeName, setEmployeeName] = useState('');
  const [reportDate, setReportDate] = useState(new Date()); 
  const [calendarDays, setCalendarDays] = useState([]); 
  const [stats, setStats] = useState({ present: 0, absent: 0, halfDay: 0 });
  const [monthName, setMonthName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { uid } = useParams();

  useEffect(() => {
    const fetchEmployeeData = async () => {
      setLoading(true);
      setError(null);
      setCalendarDays([]); 

      const today = new Date(); 
      const selectedDate = new Date(reportDate); 

      const currentYear = selectedDate.getFullYear();
      const currentMonth = selectedDate.getMonth();
      
      const isCurrentViewingMonth = 
          today.getFullYear() === currentYear && 
          today.getMonth() === currentMonth;
      
      const daysInSelectedMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const lastDayToProcess = isCurrentViewingMonth ? today.getDate() : daysInSelectedMonth;

      setMonthName(selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' }));
      const summaryStatus = {}; 

      try {
        // --- Step 1: Summary (Master) data fetch karein ---
        const summaryRes = await fetch(SUMMARY_API_URL);
        const summaryData = await summaryRes.json();
        if (summaryData.error) throw new Error(summaryData.error);
        
        const employee = summaryData.data.find(emp => emp.UID === uid);
        if (!employee) throw new Error('Employee not found');
        
        setEmployeeName(employee.Name);

        const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
        for (const key in employee) {
          if (key.startsWith(monthPrefix)) {
            summaryStatus[key] = employee[key];
          }
        }

        // --- Step 2: Har working day ke liye daily-data fetch karein ---
        const dateFetchPromises = [];
        const workingDayStrings = []; 

        for (let d = 1; d <= lastDayToProcess; d++) {
          const dateObj = new Date(currentYear, currentMonth, d);
          if (!isHoliday(dateObj)) {
            const dateString = formatDate(dateObj);
            workingDayStrings.push(dateString);
            dateFetchPromises.push(
              fetch(`${API_URL_BASE}?date=${dateString}`)
                .then(res => res.json())
                .then(jsonResult => {
                  if (jsonResult.sheetName && jsonResult.sheetName !== dateString) {
                    return { data: [] }; 
                  }
                  if (jsonResult.error) {
                     return { data: [] };
                  }
                  return jsonResult; 
                })
                .catch(err => ({ error: `Fetch failed for ${dateString}`, data: [] }))
            );
          }
        }

        const dailyResults = await Promise.all(dateFetchPromises);

        // --- Step 3: Poore mahine ka Calendar data banayein ---
        const newCalendarDays = [];
        let presentCount = 0; 
        let absentCount = 0;
        let halfDayCount = 0; 

        for (let d = 1; d <= daysInSelectedMonth; d++) {
          const currentDateObj = new Date(currentYear, currentMonth, d);
          const dateString = formatDate(currentDateObj);
          
          const dayInfo = {
            dayOfMonth: d,
            dateString: dateString,
            status: 'Future', 
            totalHours: 0,
            firstCheckIn: null, 
            lastCheckOut: null,
            isCheckedIn: false,
            isToday: (isCurrentViewingMonth && d === today.getDate())
          };

          if (d > lastDayToProcess) {
            dayInfo.status = 'Future';
          } 
          else if (isHoliday(currentDateObj)) {
            dayInfo.status = 'Holiday';
          } 
          else {
            
            let totalHours = 0;
            let firstCheckIn = null;
            let lastCheckOut = null;
            let isCheckedIn = false;
            
            const dataIndex = workingDayStrings.indexOf(dateString);
            if (dataIndex !== -1) { 
              const dailyData = dailyResults[dataIndex];
              if (dailyData && dailyData.data && dailyData.data.length > 0) {
                const employeeRow = dailyData.data.find(emp => emp.UID === uid);
                if (employeeRow) {
                  const processed = processRowData(employeeRow);
                  totalHours = processed.totalHours;
                  firstCheckIn = processed.firstCheckIn;
                  lastCheckOut = processed.lastCheckOut;
                  isCheckedIn = processed.isCheckedIn;
                }
              }
            } 
            
            dayInfo.totalHours = totalHours;
            dayInfo.firstCheckIn = firstCheckIn;
            dayInfo.lastCheckOut = lastCheckOut;
            dayInfo.isCheckedIn = isCheckedIn;

            // --- ⭐ YAHAN LOGIC THEEK KIYA GAYA HAI ---
            
            // 1. Agar 'Checked In' hai (matlab check-out nahi kiya)
            if (isCheckedIn) {
              dayInfo.status = 'Checked In'; // Calendar mein "Checked In" dikhayein
              
              // ⭐ FIX: Ise hamesha "Present (Full Day)" ginein
              presentCount++; 
            }
            // 2. Agar 'Checked Out' hai (yaani isCheckedIn = false)
            else if (totalHours > 0) {
              // Ab hum 4 ghante ka rule apply kar sakte hain
              if (totalHours < 4) {
                dayInfo.status = 'Half Day'; // Calendar mein "Half Day" dikhayein
                halfDayCount++;
              } 
              else {
                dayInfo.status = 'Present';
                presentCount++;
              }
            }
            // 3. Agar 0 ghante hain (na check-in, na totalHours)
            else {
              const masterStatus = summaryStatus[dateString];
              if (masterStatus === 'A') {
                dayInfo.status = 'Absent';
                absentCount++;
              } 
              else if (masterStatus === 'P') { 
                dayInfo.status = 'Absent';
                absentCount++;
              } 
              else {
                dayInfo.status = 'NoRecord';
              }
            }
            // --- Logic Fix End ---
          }
          newCalendarDays.push(dayInfo);
        }

        setCalendarDays(newCalendarDays);
        setStats({ present: presentCount, absent: absentCount, halfDay: halfDayCount });

      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeData();
  }, [uid, reportDate]); 

  // --- Calendar padding (No Change) ---
  const firstDayOfMonth = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1).getDay();
  const paddingDays = Array(firstDayOfMonth).fill(null);

  // --- ⭐ 4. Render Logic (No Change) ---
  if (loading) return <div className="App-container"><p>Loading employee report...</p></div>;
  if (error) return <div className="App-container"><p>Error: {error.message}</p></div>;

  return (
    <div className="App">
      {/* Page header (employee) - use separate class to avoid colliding with global app header */}
      <header className="employee-header">
        <h1>{employeeName}</h1>
        <div className="month-picker-container">
          <strong>Select Month: </strong>
          <DatePicker
            selected={reportDate}
            onChange={(date) => setReportDate(date)}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            className="month-picker-input"
          />
        </div>
      </header>

      {/* KPI Cards (KPIs ab calendar se match karenge) */}
      <div className="kpi-container">
        <div className="kpi-card kpi-good">
          <h3>Present</h3>
          <p>{stats.present}</p>
        </div>
        <div className="kpi-card kpi-warning">
          <h3>Absent</h3>
          <p>{stats.absent}</p>
        </div>
        <div className="kpi-card kpi-warning">
          <h3>Half Days</h3>
          <p>{stats.halfDay}</p>
        </div>
      </div>

      {/* Mobile attendance list: visible only on small screens (CSS will control visibility) */}
      <div className="mobile-attendance-list card" aria-hidden="false">
        <h2 className="mobile-month-title">{monthName}</h2>
        <ul className="mobile-day-list">
          {calendarDays
            .filter(day => day.status !== 'Future')
            .map(day => {
            // weekday short name
            const weekday = new Date(day.dateString).toLocaleDateString(undefined, { weekday: 'short' });
            // short status: P = Present/Checked In, A = Absent, H = Half Day, - = NoRecord
            // For Holiday show full label 'Holiday' in mobile list per request
            let shortLabel = '-';
            if (day.status === 'Present' || day.status === 'Checked In') shortLabel = 'P';
            else if (day.status === 'Absent') shortLabel = 'A';
            else if (day.status === 'Half Day') shortLabel = 'H';
            else if (day.status === 'Holiday') shortLabel = 'Holiday';

            return (
              <li key={day.dateString} className={`mobile-day-item ${day.status.toLowerCase().replace(/\s+/g,'')}`}>
                <div className="mobile-day-left">
                  <div className="mobile-day-date">{day.dateString}{new Date(day.dateString).getDay() === 0 ? ' Sunday' : ''}</div>
                    <div className="mobile-day-week">{weekday}</div>
                </div>
                <div className="mobile-day-status">{shortLabel}</div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* --- Calendar View (No Change) --- */}
      <div className="table-container card">
        <h2>{monthName}</h2>
        
        <div className="calendar-grid">
          {/* Headers (No Change) */}
          <div className="calendar-header">Sun</div>
          <div className="calendar-header">Mon</div>
          <div className="calendar-header">Tue</div>
          <div className="calendar-header">Wed</div>
          <div className="calendar-header">Thu</div>
          <div className="calendar-header">Fri</div>
          <div className="calendar-header">Sat</div>

          {/* Padding (No Change) */}
          {paddingDays.map((_, index) => (
            <div key={`pad-${index}`} className="calendar-day empty"></div>
          ))}

          {/* Mahine ke din (No Change) */}
          {calendarDays.map((day) => {
            
            if (day.status === 'Future') {
              return (
                <div key={day.dateString} className="calendar-day status-future">
                  <div className="day-number">{day.dayOfMonth}</div>
                </div>
              );
            }

            let statusClass = `status-${day.status.toLowerCase().replace(' ', '')}`; // 'Checked In' -> 'checkedin'
            if (day.isToday) statusClass += ' today';

            // short label for compact grid on mobile and consistent display
            let shortLabel = '-';
            if (day.status === 'Present' || day.status === 'Checked In') shortLabel = 'P';
            else if (day.status === 'Absent') shortLabel = 'A';
            else if (day.status === 'Half Day') shortLabel = 'H';
            else if (day.status === 'Holiday') shortLabel = 'HOL';
            else if (day.status === 'Future') shortLabel = 'F';

            return (
              <div key={day.dateString} className={`calendar-day ${statusClass}`}>
                <div className="day-number">{day.dayOfMonth}</div>
                <div className="day-status">{shortLabel}</div>
                <div className="day-details">
                  <span className="day-hours">
                    {day.totalHours > 0 ? `${day.totalHours.toFixed(2)} hrs` : (day.isCheckedIn ? '0.00 hrs' : '—')}
                  </span>
                  
                  {(day.status === 'Present' || day.status === 'Half Day' || day.status === 'Checked In') && (
                    <>
                      <span className="day-check-in">
                        In: {formatISOTimeString(day.firstCheckIn)}
                      </span>
                      {!day.isCheckedIn && (
                        <span className="day-check-out">
                          Out: {formatISOTimeString(day.lastCheckOut)}
                        </span>
                      )}
                    </>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EmployeePage;