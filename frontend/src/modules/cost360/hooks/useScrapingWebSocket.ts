import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../../../services/api';

interface ScrapingLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

interface ScrapingStatus {
  status: 'idle' | 'running' | 'paused' | 'error';
  config: any;
  log_count: number;
}

export const useScrapingWebSocket = () => {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [status, setStatus] = useState<ScrapingStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('arko_admin_token');
    const wsUrl = `${API_URL.replace('http', 'ws')}/scraping/ws/logs`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial_logs') {
            setLogs(data.logs);
          } else if (data.type === 'status') {
            setStatus(data);
          } else if (data.type === 'log') {
            setLogs(prev => [...prev, data.log]);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    logs,
    status,
    connected,
    reconnect: connect,
    disconnect
  };
};