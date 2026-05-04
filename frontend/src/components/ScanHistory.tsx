import { useState } from "react";
function ScanHistory() {

    const ResultsHistoryList = () => {
        const [items, setItems] = useState([]);
        const [inputValue, setInputValue] = useState('');

        const addItem = (e) => {
            e.preventDefault();
            if (!inputValue.trim()) return;

            setItems([...items, inputValue]);
            setInputValue('');
        };
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-brand-surface rounded-md shadow-2xl ">
            <form onSubmit={addItem} className="flex gap-2 mb-6">
                <input
                    type = "text"
                    value = {inputValue}
                    onChange ={(e) => setInputValue(e.target.value)}
                    placeholder = "Add New Task"
                    className = "flex-1 px-4 py-2 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md "
                >
                    
                </button>   
            </form>
            
        </div>
    )
}

            export default ScanHistory;
