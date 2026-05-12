import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const FileUploadArea = () => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('Accepted files:', acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'application/pdf': []
    }
  });

  return (
    <div className="mt-6">
      <div
        {...getRootProps()}
        className={`
          cursor-pointer border-2 border-dashed p-12 text-center transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          rounded-xl
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-gray-700">
            {isDragActive ? "Drop files here" : "Drag and drop files here, or click to select"}
          </p>
          <p className="text-xs text-gray-500">
            Supports images and PDFs
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUploadArea;
