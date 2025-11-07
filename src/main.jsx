// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout, TodayDashboard } from './App.jsx';
import AttendanceLog from './AttendanceLog.jsx';
import EmployeePage from './EmployeePage.jsx';
import './index.css';

const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            { path: '/', element: <TodayDashboard /> },
            { path: '/log', element: <AttendanceLog /> },
            { path: '/employee/:uid', element: <EmployeePage /> },
        ],
    },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);