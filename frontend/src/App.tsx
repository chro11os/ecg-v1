import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUpdloadArea";
function App() {
	return (
		<div className="flex flex-col gap-10 bg-slate-900 min-h-screen pb-20">
			<DiagnosisDashboard />
			<div className="px-8 max-w-6xl mx-auto w-full">
				<FileUploadArea />
			</div>
		</div>
	)
}

export default App;
