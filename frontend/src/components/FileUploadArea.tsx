import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

interface Props {
    onDataLoaded: (data: number[]) => void;
    onError: (msg: string) => void;
}

const FileUploadArea = ({ onDataLoaded, onError }: Props) => {
    const [preparedSignal, setPreparedSignal] = useState<number[] | null>(null);

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections.length > 0) {
            onError("Invalid file type. Please upload a structured .json file.");
            setPreparedSignal(null);
            return;
        }

        const file = acceptedFiles[0];
        if (!file) {
            onError("No file detected. Please try dragging the file again.");
            setPreparedSignal(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                if (Array.isArray(json.signal) && json.signal.length === 2500) {
                    setPreparedSignal(json.signal);
                } else {
                    setPreparedSignal(null);
                    onError("Invalid data structure: File must contain exactly 2,500 ECG samples under the 'signal' key.");
                }
            } catch {
                setPreparedSignal(null);
                onError("Failed to parse JSON file. Ensure it is valid JSON formatting.");
            }
        };

        try {
            reader.readAsText(file);
        } catch {
            setPreparedSignal(null);
            onError("Failed to read the contents of the file.");
        }
    }, [onError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/json': ['.json'],
            'text/plain': ['.json']
        },
        multiple: false
    });

    const getBorderClass = () => {
        if (preparedSignal) return 'border-emerald-500 bg-emerald-500/10';
        if (isDragActive) return 'border-cyan-400 bg-cyan-400/10';
        return 'border-white/10 bg-white/5';
    };

    const getTextColorClass = () => {
        if (preparedSignal) return 'text-emerald-400';
        return 'text-slate-300';
    };

    return (
        <div className="space-y-4">
            <div {...getRootProps()} className={`border-2 border-dashed p-10 rounded-3xl transition-all ${getBorderClass()}`}>
                <input {...getInputProps()} />
                <p className={`text-center font-mono text-sm ${getTextColorClass()}`}>
                    {preparedSignal ? "ONE FILE UPLOADED ✓" : (isDragActive ? "DROP ECG DATA" : "DRAG & DROP 2,500 SAMPLES (.JSON)")}
                </p>
            </div>

            {preparedSignal && (
                <button
                    onClick={() => onDataLoaded(preparedSignal)}
                    className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold rounded-2xl transition-colors tracking-wider animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                    Process
                </button>
            )}
        </div>
    );
};

export default FileUploadArea;