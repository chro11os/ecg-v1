import MenuCard from "./components/MenuCard";
import TitleCard from "./components/TitleCard";

function App() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            <div className=" p-6 ">
                <TitleCard />
            </div>
            <div className=" p-6 ">
                <MenuCard />
            </div>
        </div>
    )
}

export default App;
