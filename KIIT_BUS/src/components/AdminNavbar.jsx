import { Link } from "react-router-dom";

export default function AdminNavbar() {
  return (
    <nav className="bg-dark text-white px-6 py-4 flex justify-between items-center">
      <h1 className="text-2xl font-bold">KIIT Transport – Admin</h1>

      <div className="flex gap-6 text-sm font-semibold">
        <Link to="/admin" className="hover:text-primary">Dashboard</Link>
        <Link to="/admin/vehicles" className="hover:text-primary">Vehicles</Link>
        <Link to="/admin/hostels" className="hover:text-primary">Hostels</Link>
        <Link to="/admin/drivers" className="hover:text-primary">Drivers</Link>
        <Link to="/admin/reports" className="hover:text-primary">Reports</Link>
      </div>
    </nav>
  );
}
