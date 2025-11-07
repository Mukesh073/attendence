import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import './App.css';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Link, Outlet } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';


// Note: Dates should be in YYYY-MM-DD format."
const FESTIVAL_HOLIDAYS = [
  '2025-10-20',
  '2025-12-25',
  '2026-01-26',
];

// -----------------------------------------------------------------
// 2. API URL (From Live API)
// -----------------------------------------------------------------
const API_URL_BASE = import.meta.env.VITE_API_URL;

// -----------------------------------------------------------------
// 3. Helper Functions (Time Parsing & Date Formatting)
// -----------------------------------------------------------------


function parseTime(timeStr) {
  if (!timeStr) return null;

  // Case 1: Simple time string "HH:mm:ss"
  if (typeof timeStr === 'string' && timeStr.length <= 8 && timeStr.includes(':')) {
     const [h, m, s] = timeStr.split(':');
     const date = new Date(0);
     date.setHours(h, m, s || 0, 0); // This sets local IST time (Correct)
     return date;
  }

  // Case 2: Full ISO string API se
  try {
    const parsedDate = new Date(timeStr);
    if (isNaN(parsedDate.getTime())) return null;
    
    // This sets standard UTC time for comparison (Correct)
    const timeOnlyDate = new Date(0);
    timeOnlyDate.setUTCHours(parsedDate.getUTCHours(), parsedDate.getUTCMinutes(), parsedDate.getUTCSeconds(), 0);
    return timeOnlyDate;
    
  } catch (e) {
    console.warn(`Could not parse time: ${timeStr}`, e);
    return null;
  }
}

// --- ⭐ FIX: Helper 2: formatISOTimeString (For Display) ---
// This converts "1899-12-30T05:10:25Z" (UTC) to "10:40:25" (IST)
function formatISOTimeString(timeStr) {
  if (!timeStr) return '—';
  try {
    const dateObj = new Date(timeStr);
    if (isNaN(dateObj.getTime())) return '—';

    // Using local getHours() instead of getUTCHours()
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    const s = String(dateObj.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch (e) {
    return '—'; 
  }
}

// Function to format Date object to "yyyy-MM-dd" string
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Helper Function: Checks for Sunday and Festival"
const isHoliday = (dateObj) => {
  const dateString = formatDate(dateObj);

  if (dateObj.getDay() === 0) {
    return true;
  }
  if (FESTIVAL_HOLIDAYS.includes(dateString)) {
    return true;
  }
  return false;
};

// --- 4. Helper Function (Advanced Data Processing - Business Logic) ---
// (No changes in this function)
function processRowData(row) {
  let totalWorkMilliseconds = 0;
  let firstCheckIn = null;
  let lastCheckOut = null;
  let status = '—';
  const maxPairs = 10; 

  for (let i = 1; i <= maxPairs; i++) {
    const checkInTime = parseTime(row['Check-in ' + i]);
    const checkOutTime = parseTime(row['Check-out ' + i]);

    if (checkInTime) {
      status = 'Checked In';
      if (!firstCheckIn) { firstCheckIn = checkInTime; }
    }

    if (checkOutTime) {
      status = 'Checked Out';
      lastCheckOut = checkOutTime;
    }

    if (checkInTime && checkOutTime && checkOutTime.getTime() > checkInTime.getTime()) {
      totalWorkMilliseconds += (checkOutTime.getTime() - checkInTime.getTime());
    }
  }
  
  const totalHours = Math.max(0, totalWorkMilliseconds / (1000 * 60 * 60));

  let rowPriorityStatus = 'On Time';
  let barFillColor = '#3498db';
  let rowClass = '';

  if (status === 'Checked In') {
    const lateBy_11_00 = parseTime("11:00:00");
    if (firstCheckIn && firstCheckIn.getTime() > lateBy_11_00.getTime()) {
      rowPriorityStatus = 'Late (After 11:00)';
      barFillColor = '#c0392b';
      rowClass = 'row-late-danger';
    } else if (firstCheckIn && firstCheckIn.getTime() > parseTime("10:30:00").getTime()) {
      rowPriorityStatus = 'Late (After 10:30)';
      barFillColor = '#e67e22';
      rowClass = 'row-late-warning';
    } else {
      
      rowPriorityStatus = 'Checked In';
      barFillColor = '#34db69ff';
      rowClass = 'row-checked-in';
    }
  }
  else if (status === 'Checked Out') {
    if (totalHours >= 7) {
      rowPriorityStatus = 'Completed';
      barFillColor = '#2ecc71';
      rowClass = 'row-good';
    }
    else {
      const lateBy_11_00 = parseTime("11:00:00");
      if (firstCheckIn && firstCheckIn.getTime() > lateBy_11_00.getTime()) {
        rowPriorityStatus = 'Late (After 11:00)';
        barFillColor = '#c0392b';
        rowClass = 'row-late-danger';
      }
      else if (firstCheckIn && firstCheckIn.getTime() > parseTime("10:30:00").getTime()) {
        rowPriorityStatus = 'Late (After 10:30)';
        barFillColor = '#e67e22';
        rowClass = 'row-late-warning';
      }
      else if (lastCheckOut && lastCheckOut.getTime() < parseTime("17:30:00").getTime()) {
        rowPriorityStatus = 'Early Out (Before 17:30)';
        barFillColor = '#f1c40f';
        rowClass = 'row-early-out';
      }
      else if (totalHours > 0) {
        rowPriorityStatus = 'Under 7 Hours';
        barFillColor = '#e67e22';
        rowClass = 'row-under-time';
      }
      else {
        rowPriorityStatus = 'No Work Recorded';
        barFillColor = '#95a5a6';
        rowClass = 'row-late-warning';
      }
    }
  }
  else {
      rowPriorityStatus = 'No Data';
      barFillColor = '#95a5a6';
      rowClass = 'row-late-warning';
  }
  
  return {
    ...row,
    totalHours,
    status,
    firstCheckIn: firstCheckIn ? firstCheckIn.toTimeString().split(' ')[0] : '—',
    lastCheckOut: lastCheckOut ? lastCheckOut.toTimeString().split(' ')[0] : '—',
    rowPriorityStatus,
    barFillColor,
    rowClass,
  };
}

// --- 5. Custom DatePicker Input ---
// (No changes)
const CustomDatePickerInput = forwardRef(({ value, onClick }, ref) => (
  <h2 className="date-picker-title-button" onClick={onClick} ref={ref}>
    Employee List ({value})
    <span className="calendar-icon">📅</span>
  </h2>
));


// -----------------------------------------------------------------
// 6. Main Layout Component
// -----------------------------------------------------------------

function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-wrap">
              <img src="/logo.png" alt="Shine Infosolutions Logo" className="header-logo" />
              <div className="logo-glow" aria-hidden="true"></div>
            </div>
            <div className="header-text">
              <h1>Shine Infosolutions</h1>
              <div className="header-subtitle">Attendance Dashboard</div>
            </div>
          </div>

          {/* Mobile menu button - visible on small screens */}
          <button
            className={`mobile-menu-button ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(prev => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {/* Visible when menu is closed */}
            <svg className="hamburger-icon" width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect y="1" width="20" height="2" rx="1" fill="currentColor" />
              <rect y="6" width="20" height="2" rx="1" fill="currentColor" />
              <rect y="11" width="20" height="2" rx="1" fill="currentColor" />
            </svg>
            {/* Visible when menu is open */}
            <svg className="close-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <nav className={`nav-buttons ${menuOpen ? 'open' : ''}`}>
            <Link to="/" className="nav-button" onClick={() => setMenuOpen(false)}>Daily Dashboard</Link>
            <Link to="/log" className="nav-button" onClick={() => setMenuOpen(false)}>Master Log</Link>
          </nav>
          {/* Backdrop shown when mobile menu is open to dim/hide underlying content and close on click */}
          <div
            className={`mobile-nav-backdrop ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden={!menuOpen}
          />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
// -----------------------------------------------------------------
// 7. Aaj ka Dashboard Component
// -----------------------------------------------------------------

function TodayDashboard() {
  const [allData, setAllData] = useState([]);
  const [masterEmployeeList, setMasterEmployeeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [isCurrentDayHoliday, setIsCurrentDayHoliday] = useState(false);
  const [filterType, setFilterType] = useState('present');

  // --- Live Data Refresh Logic ---
 
  useEffect(() => {
    
    const fetchData = () => {
      setLoading(true);
      setError(null);
      setAllData([]);
      setMasterEmployeeList([]);
      setFilterType('present');
      setSearchTerm('');
      setIsCurrentDayHoliday(false);

      if (isHoliday(selectedDate)) {
          fetch(`${API_URL_BASE}?sheet=Summary`)
            .then(res => res.json())
            .then(data => {
              if (data.error) throw new Error(data.error);
              setMasterEmployeeList(data.data || [])
            })
            .catch(() => setMasterEmployeeList([]));
            
          console.warn(`${formatDate(selectedDate)} is a Holiday.`);
          setAllData([]);
          setIsCurrentDayHoliday(true);
          setLoading(false);
          return; 
      }

      const dateString = formatDate(selectedDate);
      
      Promise.all([
        fetch(`${API_URL_BASE}?sheet=Summary`),
        fetch(`${API_URL_BASE}?date=${dateString}`)
      ])
      .then(async ([summaryRes, dailyRes]) => {
        if (!summaryRes.ok) throw new Error('Failed to fetch Summary data');
        const summaryData = await summaryRes.json();
        if (summaryData.error) throw new Error(`Summary API Error: ${summaryData.error}`);
        setMasterEmployeeList(summaryData.data || []);

        let dailyData = { data: [] };
        
        if (dailyRes.ok) {
          const dailyResult = await dailyRes.json();
          if (dailyResult.error) {
              console.warn(`API error for ${dateString}: ${dailyResult.error}. Using empty data.`);
              dailyData = { data: [] };
          } else {
              dailyData = dailyResult; 
          }
        } else if (dailyRes.status === 404) {
          console.warn(`Daily file for ${dateString} not found (404).`);
          dailyData = { data: [] };
        } else {
          throw new Error(`Failed to fetch ${dateString} data with status ${dailyRes.status}`);
        }
        
        return dailyData;
      })
      .then(data => {
        const processedData = data.data.map(processRowData);
        setAllData(processedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fetch Error:", err);
        setError(`Could not load data: ${err.message}`);
        setLoading(false);
      });
    };

    fetchData();

    // Har 60 second mein auto-refresh
    const intervalId = setInterval(fetchData, 60000); 

    return () => clearInterval(intervalId);

  }, [selectedDate]); 

  // --- (kpiData logic unchanged) ---
  const kpiData = useMemo(() => {
    if (loading) return { totalRoster: 0, present: 0, absent: 0, onTime: 0, exceptions: 0, avgHours: 0 };
    if (isCurrentDayHoliday) return { totalRoster: masterEmployeeList.length, present: 0, absent: masterEmployeeList.length, onTime: 0, exceptions: 0, avgHours: 0 };

    const presentUIDs = new Set(allData.map(row => row.UID));
    const absentList = masterEmployeeList.filter(masterRow => !presentUIDs.has(masterRow.UID));

    const totalRoster = masterEmployeeList.length;
    const present = allData.length;
    const absent = absentList.length;

    if (allData.length === 0 && totalRoster > 0) {
        return { totalRoster, present: 0, absent: totalRoster, onTime: 0, exceptions: 0, avgHours: 0 };
    }

    const totalHoursSum = allData.reduce((sum, row) => sum + row.totalHours, 0);
    const avgHours = (present > 0 ? (totalHoursSum / present) : 0).toFixed(2);
    
    const onTime = allData.filter(row => row.rowClass === 'row-good' && row.status === 'Checked Out').length;
    const exceptions = allData.filter(row => row.rowClass !== 'row-good' && row.status === 'Checked Out').length;
    
    return { totalRoster, present, absent, onTime, exceptions, avgHours };
  }, [allData, masterEmployeeList, loading, isCurrentDayHoliday]);

  // --- (filteredData logic unchanged) ---
  const filteredData = useMemo(() => {
    let dataToShow = [];
    const presentUIDs = new Set(allData.map(row => row.UID));
    
    const absentList = masterEmployeeList
      .filter(masterRow => !presentUIDs.has(masterRow.UID))
      .map(absentRow => ({
        ...absentRow,
        rowPriorityStatus: 'Absent',
        rowClass: 'row-late-danger',
        totalHours: 0,
        barFillColor: '#c0392b',
      }));

    if (isCurrentDayHoliday) {
        dataToShow = masterEmployeeList.map(row => ({
            ...row,
            rowPriorityStatus: 'Holiday',
            rowClass: 'row-good',
            totalHours: 0,
            barFillColor: '#95a5a6'
        }));
    } else {
        switch (filterType) {
            case 'present':
                dataToShow = allData;
                break;
            case 'onTime':
                dataToShow = allData.filter(row => row.rowClass === 'row-good');
                break;
            case 'exceptions':
                dataToShow = allData.filter(row => row.rowClass !== 'row-good' && row.status === 'Checked Out');
                break;
            case 'absent':
                dataToShow = absentList;
                break;
            case 'all_roster':
                dataToShow = [...allData, ...absentList];
                break;
            default:
                dataToShow = allData;
        }
    }
    
    if (searchTerm) {
      return dataToShow.filter(row =>
        row.Name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return dataToShow;

  }, [allData, masterEmployeeList, filterType, searchTerm, isCurrentDayHoliday]);


  // --- (Dynamic Table Headers Logic unchanged) ---
  const getTableHeaders = () => {
    let maxPairs = 0;
    const dataForHeaders = filteredData;

    dataForHeaders.forEach(row => {
      const keys = Object.keys(row);
      const pairKeys = keys.filter(k => k.startsWith('Check-in') || k.startsWith('Check-out'));
      const maxPairNum = pairKeys.reduce((max, key) => {
        const num = parseInt(key.split(' ')[1]);
        return num > max ? num : max;
      }, 0);
      
      if (maxPairNum > maxPairs) maxPairs = maxPairNum;
    });

    if(filterType === 'absent' || isCurrentDayHoliday || (allData.length === 0 && filteredData.length > 0)) {
      return ["Name", "Status"];
    }
    
    const h = ["Name", "Status"];
    for(let i = 1; i <= maxPairs; i++) {
      h.push(`Check-in ${i}`);
      h.push(`Check-out ${i}`);
    }
    h.push("Total Work");
    return h;
  };

  const tableHeaders = getTableHeaders();


  // --- (Loading, Error, Holiday UI unchanged) ---
  if (error) return <div className="App-container"><p>Error: {error}</p></div>;

  if (isCurrentDayHoliday) {
      return (
          <>
            <div className="kpi-container">
              <div className="kpi-card"><h3>Total Employees</h3><p>{masterEmployeeList.length}</p></div>
              <div className="kpi-card"><h3>Present</h3><p>0</p></div>
              <div className="kpi-card kpi-good"><h3>Holiday</h3><p>{masterEmployeeList.length}</p></div>
              <div className="kpi-card"><h3>On Time</h3><p>0</p></div>
              <div className="kpi-card"><h3>Exceptions</h3><p>0</p></div>
            </div>
            <div className="holiday-message card">
                <h2>🎉 Company Holiday</h2>
                <p>Selected date **({formatDate(selectedDate)})** is a declared holiday (Sunday or Festival). Attendance log is not expected.</p>
                <p className="small-note">To manage festival dates, please update the `FESTIVAL_HOLIDAYS` list in `App.jsx`.</p>
            </div>
          </>
      );
  }

  // --- Normal Dashboard Return ---
  return (
    <>
      {/* (KPI Cards unchanged) */}
      <div className="kpi-container">
        <div className="kpi-card" onClick={() => { setFilterType('all_roster'); setSearchTerm(''); }}>
          <h3>Total Employees</h3><p>{loading ? '...' : kpiData.totalRoster}</p>
        </div>
        <div className="kpi-card kpi-good" onClick={() => { setFilterType('present'); setSearchTerm(''); }}>
          <h3>Present</h3><p>{loading ? '...' : kpiData.present}</p>
        </div>
        <div className="kpi-card kpi-warning" onClick={() => { setFilterType('absent'); setSearchTerm(''); }}>
          <h3>Absent</h3><p>{loading ? '...' : kpiData.absent}</p>
        </div>
        <div className="kpi-card kpi-good" onClick={() => { setFilterType('onTime'); setSearchTerm(''); }}>
          <h3>On Time</h3><p>{loading ? '...' : kpiData.onTime}</p>
        </div>
        <div className="kpi-card kpi-warning" onClick={() => { setFilterType('exceptions'); setSearchTerm(''); }}>
          <h3>Exceptions</h3><p>{loading ? '...' : kpiData.exceptions}</p>
        </div>
      </div>

      {/* (Chart container unchanged) */}
      <div className="main-content">
        <div className="chart-container card">
          <h2>Work Hours Overview</h2>
          {loading ? <div className="App-container"><p>Loading Chart...</p></div> : filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalHours" name="Total Work Hours">
                  {filteredData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.barFillColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data-message">
              No Data Available for Chart
            </div>
          )}
        </div>
        
        {/* (Table container) */}
        <div className="table-container card">
          <div className="date-picker-title-container">
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              customInput={<CustomDatePickerInput />}
              dateFormat="yyyy-MM-dd"
              popperPlacement="top-start"
              shouldCloseOnSelect={true}
            />
          </div>

          <input
            type="text"
            placeholder="Search by name..."
            className="search-bar"
            value={searchTerm}
            // --- ⭐ FIX: Search bar typo theek kiya ---
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <table>
            <thead>
              <tr>
                {tableHeaders.map(header => <th key={header}>{header}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={tableHeaders.length}>Loading...</td></tr>
              ) : filteredData.length === 0 && !isCurrentDayHoliday ? (
                <tr><td colSpan={tableHeaders.length}>No employees found.</td></tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.UID} className={row.rowClass}>
                    
                    {/* --- (Rendering Logic unchanged) --- */}
                    {tableHeaders.map(header => {
                      // Case 1: Name
                      if (header === "Name") {
                        return (
                          <td key="Name">
                            <Link to={`/employee/${row.UID}`} className="employee-link">
                              {row.Name}
                            </Link>
                          </td>
                        );
                      }
                      // Case 2: Status
                      if (header === "Status") {
                        return (
                          <td key="Status">
                            <span className={`status-badge`}>
                              {row.rowPriorityStatus}
                            </span>
                          </td>
                        );
                      }
                      // Case 3: Total Work
                      if (header === "Total Work") {
                        return (
                          <td key="Total Work">
                            {row.totalHours > 0 ? `${row.totalHours.toFixed(2)} hrs` : '—'}
                          </td>
                        );
                      }

                      // Case 4: Check-in / Check-out columns
                      // Yahan hum formatter ka istemal karenge (Ab yeh local time dikhayega)
                      if (header.startsWith('Check-in') || header.startsWith('Check-out')) {
                        return (
                          <td key={header}>
                            {formatISOTimeString(row[header])}
                          </td>
                        );
                      }
                      
                      // Case 5: Fallback
                      return (
                        <td key={header}>
                          {row[header] || '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {/* Mobile-friendly list for table (visible on very small screens) */}
          <div className="mobile-table-list">
            {loading ? (
              <div className="mobile-row card">Loading...</div>
            ) : filteredData.length === 0 && !isCurrentDayHoliday ? (
              <div className="mobile-row card">No employees found.</div>
            ) : (
              filteredData.map(row => (
                <div key={row.UID} className={`mobile-row card ${row.rowClass}`}>
                  <div className="mobile-row-top">
                    <Link to={`/employee/${row.UID}`} className="employee-link">{row.Name}</Link>
                    <div className="mobile-uid">{row.UID}</div>
                  </div>
                  <div className="mobile-row-stats">
                    <div className="stat-pill">
                      <div className="stat-key">Status</div>
                      <div className="stat-val">{row.rowPriorityStatus}</div>
                    </div>
                    <div className="stat-pill">
                      <div className="stat-key">Hours</div>
                      <div className="stat-val">{row.totalHours > 0 ? `${row.totalHours.toFixed(2)}` : '—'}</div>
                    </div>
                    {/* Show first few check-in/out columns compactly */}
                    {tableHeaders.filter(h => h.startsWith('Check-in') || h.startsWith('Check-out')).slice(0,4).map(h => (
                      <div key={h} className={`stat-pill`}> 
                        <div className="stat-key">{h.replace(/\s+/g,'')}</div>
                        <div className="stat-val">{formatISOTimeString(row[h])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// --- 8. App.jsx se Layout aur TodayDashboard ko export karein ---
export { Layout, TodayDashboard };