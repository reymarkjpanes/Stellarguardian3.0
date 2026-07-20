import React, { useState, useRef } from "react";

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string;
  maxSizeMb?: number;
  isUploading?: boolean;
  uploadProgress?: number;
}

export function Dropzone({ onFileSelect, acceptedTypes, maxSizeMb, isUploading, uploadProgress }: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const validateFile = (file: File): boolean => {
    setError(null);
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${maxSizeMb}MB.`);
      return false;
    }
    if (acceptedTypes) {
      const types = acceptedTypes.split(",").map(t => t.trim());
      // basic mime check, in a real app would be more robust
      if (!types.some(type => file.type.includes(type.replace("/*", "")))) {
        setError(`Invalid file type. Accepted types: ${acceptedTypes}`);
        return false;
      }
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file && validateFile(file)) {
        onFileSelect(file);
      }
    }
  };

  if (isUploading) {
    return (
      <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5 mb-2">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress || 0}%` }}></div>
        </div>
        <p className="text-sm text-gray-600 font-medium">Uploading... {uploadProgress || 0}%</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`w-full border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-700 font-medium mb-1">
          <span className="text-indigo-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          {acceptedTypes ? `${acceptedTypes}` : "Any file"} {maxSizeMb ? `(up to ${maxSizeMb}MB)` : ""}
        </p>
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          accept={acceptedTypes} 
          onChange={handleChange} 
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
