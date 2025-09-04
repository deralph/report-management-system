// components/Layout/Navbar.js
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsProfileOpen(false);
  };

  const isActiveLink = (path) => {
    return location.pathname === path ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-blue-700 hover:text-white';
  };

  return (
    <nav className="bg-blue-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <img
                className="h-8 w-8 mr-2"
                src="/aaua_logo.png"
                alt="AAUA Logo"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjMjU2M0VBIi8+Cjx0ZXh0IHg9IjUiIHk9IjE2IiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiI+QUFVQTwvdGV4dD4KPC9zdmc+';
                }}
              />
              <span className="text-white font-bold text-xl">AAUA Security System</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            <div className="ml-10 flex items-baseline space-x-4">
              {user ? (
                <>
                  <Link
                    to={user.role === 'admin' ? '/admin' : '/dashboard'}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink(user.role === 'admin' ? '/admin' : '/dashboard')}`}
                  >
                    {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                  </Link>
                  
                  <Link
                    to="/report/new"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink('/report/new')}`}
                  >
                    Report Incident
                  </Link>
                  
                  <Link
                    to="/community"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink('/community')}`}
                  >
                    Community
                  </Link>
                  
                  {/* {(user.role === 'admin' || user.role === 'security') && (
                    <Link
                      to="/admin"
                      className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink('/admin')}`}
                    >
                      Admin Panel
                    </Link>
                  )} */}
                  
                  {/* User Profile Dropdown */}
                  <div className="relative ml-3">
                    <div>
                      <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 focus:ring-white"
                        id="user-menu-button"
                        aria-expanded="false"
                        aria-haspopup="true"
                      >
                        <span className="sr-only">Open user menu</span>
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <span className="ml-2 text-white font-medium hidden lg:inline">
                          {user.name}
                        </span>
                        <svg className="ml-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {isProfileOpen && (
                      <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm text-gray-900 font-medium">{user.name}</p>
                          <p className="text-xs text-gray-600 capitalize">{user.role}</p>
                          {user.matricNumber && (
                            <p className="text-xs text-gray-600">{user.matricNumber}</p>
                          )}
                        </div>
                        <Link
                          to="/profile"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Your Profile
                        </Link>
                        {/* <Link
                          to="/settings"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Settings
                        </Link> */}
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink('/login')}`}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${isActiveLink('/register')}`}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!isOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-blue-800">
            {user ? (
              <>
                <div className="px-3 py-2 border-b border-blue-700">
                  <p className="text-sm text-white font-medium">{user.name}</p>
                  <p className="text-xs text-gray-300 capitalize">{user.role}</p>
                  {user.matricNumber && (
                    <p className="text-xs text-gray-300">{user.matricNumber}</p>
                  )}
                </div>
                
                <Link
                  to={user.role === 'admin' ? '/admin' : '/dashboard'}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink(user.role === 'admin' ? '/admin' : '/dashboard')}`}
                  onClick={() => setIsOpen(false)}
                >
                  Dashboard
                </Link>
                
                <Link
                  to="/report/new"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink('/report/new')}`}
                  onClick={() => setIsOpen(false)}
                >
                  Report Incident
                </Link>
                
                <Link
                  to="/community"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink('/community')}`}
                  onClick={() => setIsOpen(false)}
                >
                  Community
                </Link>
                
                {(user.role === 'admin' || user.role === 'security') && (
                  <Link
                    to="/admin"
                    className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink('/admin')}`}
                    onClick={() => setIsOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
                
                <Link
                  to="/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-blue-700 hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  Your Profile
                </Link>
                
                {/* <Link
                  to="/settings"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-blue-700 hover:text-white"
                  onClick={() => setIsOpen(false)}
                >
                  Settings
                </Link> */}
                
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-blue-700 hover:text-white"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink('/login')}`}
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${isActiveLink('/register')}`}
                  onClick={() => setIsOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;