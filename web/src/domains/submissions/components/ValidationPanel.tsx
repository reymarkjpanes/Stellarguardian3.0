import React from "react";

interface ValidationPanelProps {
  validationResult: any;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function ValidationPanel({ validationResult, onSubmit, isSubmitting }: ValidationPanelProps) {
  if (!validationResult) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  const { isReady, progress, missing, passed, warnings, errors } = validationResult;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[calc(100vh-120px)] sticky top-24">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Submission Readiness</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl font-bold text-gray-900">{progress}%</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isReady ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {isReady ? "Ready to submit" : "Incomplete"}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${isReady ? 'bg-green-500' : 'bg-indigo-500'}`} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {/* Errors / Blocking Issues */}
        {(errors.length > 0 || missing.length > 0) && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Blocking Issues</h4>
            <ul className="space-y-2">
              {errors.map((err: string, i: number) => (
                <li key={`err-${i}`} className="flex items-start text-sm text-red-600">
                  <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {err}
                </li>
              ))}
              {missing.map((miss: string, i: number) => (
                <li key={`miss-${i}`} className="flex items-start text-sm text-amber-600">
                  <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Missing required: {miss}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Passed Sections */}
        {passed.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Completed</h4>
            <ul className="space-y-2">
              {passed.map((pass: string, i: number) => (
                <li key={`pass-${i}`} className="flex items-center text-sm text-green-700">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {pass}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Warnings */}
        {warnings.length > 0 && (
           <div>
             <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recommendations</h4>
             <ul className="space-y-2">
               {warnings.map((warn: string, i: number) => (
                 <li key={`warn-${i}`} className="text-sm text-gray-600 flex items-start">
                   <span className="mr-2 text-gray-400">•</span>
                   {warn}
                 </li>
               ))}
             </ul>
           </div>
        )}
      </div>

      <div className="p-6 border-t border-gray-200 bg-white">
        <button
          disabled={!isReady || isSubmitting}
          onClick={onSubmit}
          className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
            isReady 
              ? "bg-indigo-600 hover:bg-indigo-700" 
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? "Submitting..." : "Submit Project"}
        </button>
        {!isReady && (
          <p className="mt-2 text-xs text-center text-gray-500">
            Complete all required sections to submit.
          </p>
        )}
      </div>
    </div>
  );
}
