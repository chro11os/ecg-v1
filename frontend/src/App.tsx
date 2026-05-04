import MenuCard from "./components/MenuCard";
import ScanHistory from "./components/ScanHistory";

function App() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            <div className=" p-6 ">
                <ScanHistory />
            </div>
            <div className=" p-6 ">
                <MenuCard />
            </div>
            <div className=" p-6 ">

            </div>
        </div>
    )
}

export default App;
