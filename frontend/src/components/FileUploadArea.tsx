import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface Props {
    onDataLoaded: (data: number[]) => void;
    onError: (msg: string) => void;
}

const FileUploadArea = ({ onDataLoaded, onError }: Props) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                if (Array.isArray(json.signal) && json.signal.length === 2500) {
                    onDataLoaded(json.signal);
                } else {
                    onError("Invalid data: File must contain exactly 2500 ECG samples.");
                }
            } catch (e) {
                onError("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);
    }, [onDataLoaded, onError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/json': ['.json'], 'text/csv': ['.csv'] },
        multiple: false
    });

    return (
        <div {...getRootProps()} className={`border-2 border-dashed p-10 rounded-3xl transition-all ${isDragActive ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}>
            <input {...getInputProps()} />
            <p className="text-center text-slate-300 font-mono text-sm">
                {isDragActive ? "DROP ECG DATA" : "DRAG & DROP 2,500 SAMPLES (.JSON)"}
            </p>
        </div>
    );
};

export default FileUploadArea;