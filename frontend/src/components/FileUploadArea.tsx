import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

interface Props {
    onDataLoaded: (data: number[], fileName: string) => void;
    onError: (msg: string) => void;
    actionLabel?: string;
    compact?: boolean;
}

const FileUploadArea = ({ onDataLoaded, onError, actionLabel = "Analyze strip", compact = false }: Props) => {
    const [preparedSignal, setPreparedSignal] = useState<number[] | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const reject = useCallback((msg: string) => {
        setPreparedSignal(null);
        setFileName(null);
        onError(msg);
    }, [onError]);

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (fileRejections.length > 0) return reject("That file isn't JSON. Upload a .json file with a \"signal\" array.");
        const file = acceptedFiles[0];
        if (!file) return reject("No file came through. Try dropping it again.");

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                if (Array.isArray(json.signal) && json.signal.length === 2500) {
                    setPreparedSignal(json.signal);
                    setFileName(file.name);
                } else {
                    reject("The file needs a \"signal\" array of exactly 2,500 samples (10 seconds at 250 Hz).");
                }
            } catch {
                reject("The file isn't valid JSON.");
            }
        };
        reader.onerror = () => reject("The file couldn't be read.");
        reader.readAsText(file);
    }, [reject]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/json': ['.json'], 'text/plain': ['.json'] },
        multiple: false,
    });

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={`ecg-paper relative flex cursor-pointer items-center justify-center rounded-lg border-2 px-4 transition-colors ${
                    compact ? "min-h-28" : "min-h-56"
                } ${isDragActive || preparedSignal ? "border-solid border-ink" : "border-dashed border-ink-faint hover:border-ink"}`}
            >
                <input {...getInputProps()} aria-label="ECG strip file" />
                {!compact && (
                    // Calibration pulse, as printed at the start of every ECG strip
                    <svg className="absolute left-6 top-1/2 hidden -translate-y-1/2 sm:block" width="54" height="64" viewBox="0 0 54 64" aria-hidden>
                        <path d="M0 62 H9 V2 H39 V62 H54" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" />
                    </svg>
                )}
                <div className="rounded-md bg-sheet/90 px-4 py-3 text-center">
                    {preparedSignal && fileName ? (
                        <>
                            <p className="font-semibold">{fileName}</p>
                            <p className="text-sm text-ink-soft">2,500 samples, ready</p>
                        </>
                    ) : isDragActive ? (
                        <p className="font-semibold">Drop to load the strip</p>
                    ) : (
                        <>
                            <p className="font-semibold">Drop an ECG strip here</p>
                            <p className="text-sm text-ink-soft">
                                or <span className="underline underline-offset-2">choose a file</span>
                                {!compact && <>: JSON with 2,500 samples at 250 Hz under "signal"</>}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {preparedSignal && fileName && (
                <button
                    type="button"
                    onClick={() => onDataLoaded(preparedSignal, fileName)}
                    className="w-full rounded-md bg-ink py-2.5 font-medium text-white hover:bg-ink/85"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default FileUploadArea;
