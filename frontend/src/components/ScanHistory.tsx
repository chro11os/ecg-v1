function ScanHistory() {
    const PatientList = ["albert", "ramona", "cordova", "guzman", "gatchalian"];

    const ListPatients = PatientList.map((patient, index) => (
        <li key={index}>{patient}</li>
    ));

    return (
        <div className="text-brand-dark bg-brand-surface hover:text-brand-surface hover:bg-brand-dark p-7">
            <ul>{ListPatients}</ul>
        </div>
    );
}
   

export default ScanHistory;
