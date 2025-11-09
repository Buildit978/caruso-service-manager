// src/components/common/ErrorMessage.tsx
import React from 'react';

interface ErrorMessageProps {
    message?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => (
    <div className="py-3 px-4 rounded-md bg-red-100 text-red-800 text-sm">
        {message || 'Something went wrong.'}
    </div>
);

export default ErrorMessage;
