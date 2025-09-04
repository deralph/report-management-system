// components/Chat/CommunityChat.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';

const CommunityChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trendingIncidents, setTrendingIncidents] = useState([]);
  const [showTrendingMobile, setShowTrendingMobile] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const { user, api } = useAuth();

  // Helper function to get user name from message
  const getUserName = (message) => {
    if (typeof message.user === 'string') {
      return message.user;
    } else if (message.user && typeof message.user === 'object') {
      return message.user.name || 'Unknown User';
    }
    return 'Unknown User';
  };

  // Helper function to get user initial
  const getUserInitial = (message) => {
    const userName = getUserName(message);
    return userName ? userName.charAt(0).toUpperCase() : 'U';
  };

  // Helper function to get user ID
  const getUserId = (message) => {
    if (message.userId) {
      return message.userId;
    } else if (message.user && typeof message.user === 'object') {
      return message.user._id;
    }
    return null;
  };

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      
      // Disconnect existing socket if any
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Create new socket connection
      const newSocket = io(backendUrl, {
        transports: ['websocket', 'polling']
      });
      
      newSocket.on('connect', () => {
        console.log('Connected to chat server');
        setSocket(newSocket);
        socketRef.current = newSocket;
        setIsConnected(true);
        setError('');
      });
      
      newSocket.on('receive-message', (message) => {
        // Prevent duplicate messages by checking if message already exists
        setMessages(prev => {
          console.log("messages= ",messages)
          const messageExists = prev.some(msg => 
            msg._id === message._id || 
            (msg.text === message.text && getUserId(msg) === getUserId(message) && msg.timestamp === message.timestamp)
          );
          
          if (!messageExists) {
            return [...prev, message];
          }
          return prev;
        });
      });
      
      newSocket.on('error', (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please refresh the page.');
        setIsConnected(false);
      });
      
      newSocket.on('disconnect', () => {
        console.log('Disconnected from chat server');
        setIsConnected(false);
      });
      
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setError('Failed to connect to chat server');
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    fetchMessages();
    fetchTrendingIncidents();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connectWebSocket]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const fetchMessages = async () => {
    try {
      const response = await api.get('/api/chat/messages');
      setMessages(response.data.data.messages || []);
         console.log("messages= ",response.data.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTrendingIncidents = async () => {
    try {
      const response = await api.get('/api/reports/trending/incidents');
      setTrendingIncidents(response.data.data.incidents || []);
    } catch (error) {
      console.error('Error fetching trending incidents:', error);
    }
  };
  
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    if (!isConnected) {
      setError('Not connected to chat. Please try again.');
      return;
    }
    
    try {
      const messageData = {
        userId: user._id,
        text: newMessage.trim()
      };
      
      // Clear input immediately
      setNewMessage('');
      
      // Send via WebSocket if connected
      if (socket && socket.connected) {
        socket.emit('send-message', messageData);
      } else {
        // Fallback to HTTP API if WebSocket is not available
        await api.post('/api/chat/messages', {
          text: newMessage.trim()
        });
        // Refresh messages after sending
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Trending Incidents Sidebar Component
  const TrendingSidebar = () => (
    <div className="bg-white shadow-md rounded-lg p-6 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Trending Incidents</h2>
        <button 
          onClick={() => setShowTrendingMobile(false)}
          className="lg:hidden text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      {trendingIncidents.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <p className="text-gray-500">No trending incidents</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trendingIncidents.map((incident, index) => (
            <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
              <div className="flex items-start mb-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  incident.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {incident.status}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {new Date(incident.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-medium text-gray-900">{incident.title}</h3>
              <p className="text-sm text-gray-600 truncate">{incident.description}</p>
              <div className="flex items-center mt-2">
                <span className="text-xs text-gray-500">
                  {incident.category.replace('-', ' ')}
                </span>
                <span className="mx-2 text-gray-300">•</span>
                <span className="text-xs text-gray-500">
                  {incident.location}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-2">Emergency Contacts</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>Campus Security: <strong>+234-XXX-XXXX-XXX</strong></li>
          <li>Medical Emergency: <strong>+234-XXX-XXXX-XXX</strong></li>
          <li>Fire Department: <strong>+234-XXX-XXXX-XXX</strong></li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Community Chat</h1>
      <p className="text-gray-600 mb-8">Discuss trending topics and security concerns with the AAUA community.</p>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Chat Area */}
        <div className="lg:flex-1 bg-white shadow-md max-h-[100vh] rounded-lg p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Community Discussion</h2>
            <div className="flex items-center">
              <button 
                onClick={() => setShowTrendingMobile(true)}
                className="lg:hidden bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                Trending
              </button>
              <div className="flex items-center ml-3">
                <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-500">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
                <p className="text-gray-500">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div 
                  key={message._id || index} 
                  className={`mb-4 flex ${getUserId(message) === user._id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs md:max-w-md p-3`}>
                    <div className={`flex items-center ${getUserId(message) === user._id ? 'justify-end' : 'justify-start'} mb-1`} >
                      <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-2">
                       <p className="text-[8px]"> {getUserInitial(message)}</p>
                      </div>  
                      <p className="font-semibold text-[8px]">{getUserName(message)}</p>
                    </div>
                    <p className={`mt-1 text-gray-800 ${getUserId(message) === user._id ? 'bg-blue-100' : 'bg-gray-100'} rounded-lg p-2`}>{message.text}</p>
                    <p className="text-[8px] text-gray-500 mt-1 text-right">
                      {formatTime(message.updatedAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat Input Form */}
          <div className="p-3 rounded-lg">
            <div className="flex items-center">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-grow px-4 py-3 border border-gray-300 rounded-full mr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isConnected}
              />
              <button
                onClick={sendMessage}
                disabled={!isConnected || !newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
                Send
              </button>
            </div>
            {/* <div className="flex items-center justify-between mt-2">
              <div className="flex space-x-2">
                <button className="text-gray-500 hover:text-gray-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                  </svg>
                </button>
              </div>
              <span className="text-xs text-gray-500">
                {newMessage.length}/500
              </span>
            </div> */}
          </div>
        </div>
        
        {/* Trending Incidents Sidebar - Desktop */}
        <div className="hidden lg:block lg:w-80">
          <TrendingSidebar />
        </div>
      </div>

      {/* Trending Incidents Modal - Mobile */}
      {showTrendingMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
          <div className="fixed right-0 top-0 h-full w-4/5 max-w-sm bg-white shadow-lg overflow-y-auto">
            <TrendingSidebar />
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityChat;