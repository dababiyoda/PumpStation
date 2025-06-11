import NavBar from '../components/NavBar'

export default function Home() {
  return (
    <>
      <NavBar />
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">PumpStation Home</h1>
        <p>Welcome to the PumpStation app.</p>
      </div>
    </>
  )
}
