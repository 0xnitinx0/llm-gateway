import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';

export const AdminNotice: React.FC<{ message: string; status?: number }> = ({ message, status = 401 }) => (
  <Card title={status === 401 ? 'Admin access required' : status === 0 ? 'Gateway offline' : status === 503 ? 'Service unavailable' : 'Unable to load live data'} subtitle={status === 401 ? 'Live operational data is protected by the gateway admin key.' : 'Review the gateway connection and try again.'}>
    <p role="alert" className="text-sm text-earth-600">{message}</p>
    <Link to="/settings" className="inline-block mt-3 text-sm font-semibold text-earth-800 hover:underline">{status === 401 ? 'Configure admin key in Settings' : 'Review connection in Settings'}</Link>
  </Card>
);
