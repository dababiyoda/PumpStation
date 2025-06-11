import NavBar from '../components/NavBar'

export default function Dashboard() {
  return (
    <>
      <NavBar />
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">Dashboard</h1>
        <p>This is the dashboard page.</p>
      </div>
    </>
  )
}
