import React from 'react';

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => (
  <div className="error-display">
    <strong>Error:</strong> {message}
  </div>
);

export default ErrorMessage;
