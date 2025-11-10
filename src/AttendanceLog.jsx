import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker'; // ⭐ 1. DatePicker को import करें
import "react-datepicker/dist/react-datepicker.css";
import './App.css'; 

// --- Helper function (YYYY-MM format) ---
function getYearMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // e.g., "2025-11"
}

function AttendanceLog() {
  const [logData, setLogData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- ⭐ 2. 'selectedMonth' के लिए state बनाएँ ---
  const [selectedMonth, setSelectedMonth] = useState(new Date()); 
  const [monthName, setMonthName] = useState('');

  // --- ⭐ 3. useEffect को 'selectedMonth' पर depend कराएँ ---
  useEffect(() => {
    setLoading(true);
    setError(null);

    const monthQuery = getYearMonth(selectedMonth); // e.g., "2025-11"
    const API_URL = `${import.meta.env.VITE_API_URL}?summary_month=${monthQuery}`;
    
    // Title के लिए महीने का नाम सेट करें
    const newMonthName = selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    setMonthName(newMonthName);

    // --- API से fetch करें ---
    fetch(API_URL)
      .then(response => response.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        
        // Group rows by name and merge their data
        const rawData = data.data || [];
        const groupedData = {};
        
        rawData.forEach(row => {
          const name = row.Name;
          if (!groupedData[name]) {
            groupedData[name] = { ...row };
          } else {
            // Merge attendance data, keeping non-empty values
            Object.keys(row).forEach(key => {
              if (key !== 'Name' && key !== 'UID') {
                if (!groupedData[name][key] || groupedData[name][key] === '-' || groupedData[name][key] === '') {
                  groupedData[name][key] = row[key];
                }
              }
            });
          }
        });
        
        setLogData(Object.values(groupedData));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedMonth]); // ⭐ जब 'selectedMonth' बदलेगा, यह दोबारा चलेगा

  // --- ⭐ 4. Render Logic ---
  const headers = logData.length > 0 ? Object.keys(logData[0]).filter(h => h !== 'UID') : [];

  return (
    <div className="table-container card">
      
      {/* --- ⭐ 5. Month Picker UI यहाँ जोड़ें --- */}
      <div className="month-picker-container" style={{ marginBottom: '20px' }}>
        <h2>Master Attendance Log</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong>Select Month: </strong>
          <DatePicker
            selected={selectedMonth}
            onChange={(date) => setSelectedMonth(date)}
            dateFormat="MMMM yyyy"
            showMonthYearPicker
            className="month-picker-input"
          />
        </div>
      </div>
      {/* Mobile-friendly list (visible on small screens) */}
      <div className="mobile-log-list">
        {loading ? (
          <div className="mobile-row card">Loading...</div>
        ) : error ? (
          <div className="mobile-row card">Error: {error}</div>
        ) : logData.length === 0 ? (
          <div className="mobile-row card">No attendance data found for {monthName}.</div>
        ) : (
          logData.map(row => (
            <div key={row.UID} className="mobile-row card">
              <div className="mobile-row-top">
                <Link to={`/employee/${row.UID}`} className="employee-link">{row.Name}</Link>
                <div className="mobile-uid">{row.UID}</div>
              </div>
              <div className="mobile-row-stats">
                {headers.filter(h => h !== 'Name' && h !== 'UID').slice(0, 8).map(h => {
                  const raw = row[h];
                  // Determine display key: if header is ISO date like 2025-11-02, show day number
                  let displayKey = h;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(h)) {
                    const d = new Date(h);
                    if (!isNaN(d)) displayKey = String(d.getDate());
                  } else if (h.length > 6) {
                    displayKey = h.slice(0, 3);
                  }

                  // Normalize value to single-letter status where possible
                  let displayVal = '-';
                  let cls = '';
                  if (raw === 'P' || raw === 'p' || String(raw).toLowerCase() === 'present') { displayVal = 'P'; cls = 'present'; }
                  else if (raw === 'A' || raw === 'a' || String(raw).toLowerCase() === 'absent') { displayVal = 'A'; cls = 'absent'; }
                  else if (raw === 'H' || String(raw).toLowerCase() === 'holiday' || String(raw).toLowerCase() === 'hol') { displayVal = 'H'; cls = 'holiday'; }
                  else if (raw !== undefined && raw !== null && String(raw).trim() !== '') { displayVal = String(raw); }

                  return (
                    <div key={h} className={`stat-pill ${cls}`} title={`${h}: ${raw}`}>
                      <strong className="stat-key">{displayKey}</strong>
                      <span className="stat-val">{displayVal}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Table ko scrollable banayein */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{borderSpacing: '3px', borderCollapse: 'separate'}}>
          <thead>
            <tr>
              {headers.length > 0 ? (
                 headers.map((header, index) => {
                   // If header is a date (YYYY-MM-DD format), show only day number
                   if (/^\d{4}-\d{2}-\d{2}$/.test(header)) {
                     const date = new Date(header);
                     return <th key={header} style={{width: '20px', minWidth: '20px', textAlign: 'center'}}>{date.getDate()}</th>;
                   }
                   // Add gap after Name column
                   const style = header === 'Name' ? {paddingRight: '50px'} : {};
                   return <th key={header} style={style}>{header}</th>;
                 })
              ) : (
                <th>No Data</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={headers.length || 1}>Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={headers.length || 1}>Error: {error}</td></tr>
            ) : logData.length === 0 ? (
              <tr>
                <td colSpan={headers.length || 1}>No attendance data found for {monthName}.</td>
              </tr>
            ) : (
              logData.map((row) => (
                <tr key={row.UID}>
                  {headers.map(header => {
                    let cellStyle = {};
                    const value = row[header];
                    
                    // Add colors for status values
                    if (/^\d{4}-\d{2}-\d{2}$/.test(header)) {
                      if (value === 'P' || value === 'Present') {
                        cellStyle = { backgroundColor: '#28d751ff', color: '#121312ff' };
                      } else if (value === 'A' || value === 'Absent') {
                        cellStyle = { backgroundColor: '#e81c11ff', color: '#14100fff' };
                      } else if (value === 'L' || value === 'Leave') {
                        cellStyle = { backgroundColor: '#f5f51cff', color: '#111010ff' };
                      } else if (value === 'WFH' || value === 'Work From Home') {
                        cellStyle = { backgroundColor: '#41ec16ff', color: '#131415ff' };
                      } else if (value === 'H' || value === 'Holiday') {
                        cellStyle = { backgroundColor: '#d1ecf1', color: '#0c5460' };
                      } else if (value === 'HD' || value === 'Half Day') {
                        cellStyle = { backgroundColor: '#26e6d9ff', color: '#0d0d0fff' };
                      }
                    }
                    
                    const isDateColumn = /^\d{4}-\d{2}-\d{2}$/.test(header);
                    const textAlign = header === 'Name' ? 'left' : 'center';
                    
                    return (
                      <td key={header} style={{...cellStyle, textAlign}}>
                        {header === 'Name' ? (
                          <Link to={`/employee/${row.UID}`} className="employee-link">
                            {row[header]}
                          </Link>
                        ) : (
                          row[header] || '-'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AttendanceLog;