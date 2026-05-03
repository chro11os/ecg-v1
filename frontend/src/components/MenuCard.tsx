function MenuCard() {
    return (
        <div className="flex flex-col items-start gap-2 shadow-2xl border-2 bg-brand-dark text-brand-bg text-4xl p-7 rounded-md">
            <button className="text-brand-bg">scan</button>
            <button className="text-brand-bg">scan history</button>
            <button className="text-brand-bg">about</button>
        </div >
    );
}

export default MenuCard;
