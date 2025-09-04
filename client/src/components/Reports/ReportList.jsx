// components/Reports/ReportList.js
import React from 'react';
import { Link } from 'react-router-dom';

const ReportList = ({ reports, showActions = false, onDelete, onStatusUpdate }) => {
  const getStatusBadge = (status) => {
    const statusClasses = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      'resolved': 'bg-green-100 text-green-800',
      'referred': 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status.replace('-', ' ').toUpperCase()}
      </span>
    );
  };

  const getCategoryLabel = (category) => {
    const categories = {
      'theft': 'Theft & Burglary',
      'assault': 'Physical Assault',
      'fire': 'Fire Outbreak',
      'medical': 'Medical Emergency',
      'vandalism': 'Vandalism',
      'substance': 'Substance Abuse',
      'unauthorized': 'Unauthorized Access',
      'environmental': 'Environmental Hazard',
      'protest': 'Protest & Disturbance'
    };
    
    return categories[category] || category;
  };

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Title
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Category
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
              Date
            </th>
            {showActions && (
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {reports.map((report) => (
            <tr key={report._id}>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                <Link 
                  to={`/report/${report._id}`} 
                  className="text-blue-600 hover:text-blue-900 font-medium"
                >
                  {report.title}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 capitalize">
                {getCategoryLabel(report.category)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {getStatusBadge(report.status)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                {new Date(report.createdAt).toLocaleDateString()}
              </td>
              {showActions && (
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Link
                    to={`/report/${report._id}`}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    View
                  </Link>
                  <Link
                    to={`/report/edit/${report._id}`}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => onDelete(report._id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {reports.length === 0 && (
        <div className="text-center py-8 bg-white">
          <p className="text-gray-500">No reports found.</p>
        </div>
      )}
    </div>
  );
};

export default ReportList;