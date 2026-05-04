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
            )
}

            export default ScanHistory;
