import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Cpu } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-sm">
        <Cpu className="w-7 h-7" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">404 - Page Not Found</h2>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-2 mb-6 leading-relaxed">
        The requested endpoint or portal view could not be located in this Gateway workspace.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
