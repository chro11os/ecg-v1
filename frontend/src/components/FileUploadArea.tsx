import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

interface Props {
    onDataLoaded: (data: number[], fileName: string) => void;
    onError: (msg: string) => void;
}

const FileUploadArea = ({ onDataLoaded, onError }: Props) => {
    const [preparedSignal, setPreparedSignal] = useState<number[] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections.length > 0) {
            onError("Invalid file type. Please upload a structured .json file.");
            setPreparedSignal(null);
            setFileName(null);
            return;
        }

        const file = acceptedFiles[0];
        if (!file) {
            onError("No file detected. Please try dragging the file again.");
            setPreparedSignal(null);
            setFileName(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                if (Array.isArray(json.signal) && json.signal.length === 2500) {
                    setPreparedSignal(json.signal);
                    setFileName(file.name);
                } else {
                    setPreparedSignal(null);
                    setFileName(null);
                    onError("Invalid data structure: File must contain exactly 2,500 ECG samples under the 'signal' key.");
                }
            } catch {
                setPreparedSignal(null);
                setFileName(null);
                onError("Failed to parse JSON file. Ensure it is valid JSON formatting.");
            }
        };

        try {
            reader.readAsText(file);
        } catch {
            setPreparedSignal(null);
            setFileName(null);
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
        if (preparedSignal) return 'border-emerald-500 dark:border-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-[0_4px_20px_rgba(16,185,129,0.06)] border-solid';
        if (isDragActive) return 'border-cyan-400 dark:border-cyan-400 bg-cyan-400/5 dark:bg-cyan-400/10 animate-pulse';
        return 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-xs dark:shadow-none hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/50 dark:hover:bg-white/5';
    };

    const getTextColorClass = () => {
        if (preparedSignal) return 'text-emerald-500 dark:text-emerald-400';
        return 'text-slate-500 dark:text-slate-300';
    };

    return (
        <div className="space-y-4">
            <div 
                {...getRootProps()} 
                className={`border-2 border-dashed p-10 rounded-none cursor-pointer transition-all duration-300 ${getBorderClass()}`}
            >
                <input {...getInputProps()} />
                <div className={`text-center font-mono text-sm transition-all duration-300 ${getTextColorClass()}`}>
                    {preparedSignal && fileName ? (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-300">
                            <span className="text-emerald-500 dark:text-emerald-400 font-bold tracking-wider text-base">
                                READY: {fileName}
                            </span>
                            <span className="text-xs text-slate-400 font-mono tracking-normal">
                                (2,500 samples parsed successfully)
                            </span>
                        </div>
                    ) : (
                        isDragActive ? (
                            <span className="text-cyan-400 font-bold tracking-widest animate-bounce">
                                DROP ECG DATA HERE
                            </span>
                        ) : (
                            <span className="tracking-wide">
                                DRAG & DROP 2,500 SAMPLES (.JSON)
                            </span>
                        )
                    )}
                </div>
            </div>

            {preparedSignal && fileName && (
                <button
                    onClick={() => onDataLoaded(preparedSignal, fileName)}
                    className="w-full py-3.5 bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-mono font-bold rounded-none transition-all duration-300 tracking-wider animate-in fade-in slide-in-from-bottom-2 shadow-md hover:shadow-lg shadow-cyan-500/10 dark:shadow-cyan-500/5 hover:shadow-cyan-500/20 active:scale-[0.99] cursor-pointer"
                >
                    PROCESS ECG SIGNAL
                </button>
            )}
        </div>
    );
};

export default FileUploadArea;