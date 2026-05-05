import {useState} from "react";
function ScanButton() {
    const [value, setValue] = useState('');
    return (
        <div className="flex gap-2 p-4">
            <input
                className="flex gap-2 p-4"
                onChange={(e) => {setValue(e.target.value)}}
            />
            <button className="p-8 text-2xl shadow-neutral-50 rounded-sm bg-brand-surface text-brand-dark hover:bg-brand-dark hover:text-brand-surface"
            onClick={() => alert(value)}>
                Scan
            </button>
        </div>
    )
}
export default ScanButton;