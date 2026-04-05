'use client';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
}

interface ValidationDisplayProps {
  errors: ValidationError[];
}

export function ValidationDisplay({ errors }: ValidationDisplayProps) {
  if (errors.length === 0) return null;

  const errorMessages = errors.filter(e => e.type === 'error');
  const warningMessages = errors.filter(e => e.type === 'warning');

  return (
    <div className="mb-6 space-y-3">
      {/* エラー表示 */}
      {errorMessages.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
                入力エラー
              </h3>
              <ul className="space-y-1.5">
                {errorMessages.map((error, i) => (
                  <li key={i} className="text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">•</span>
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 警告表示 */}
      {warningMessages.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-lg p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">
                警告
              </h3>
              <ul className="space-y-1.5">
                {warningMessages.map((warning, i) => (
                  <li key={i} className="text-yellow-700 dark:text-yellow-300 text-sm flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">•</span>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
