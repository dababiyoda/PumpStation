import NavBar from '../components/NavBar'

export default function Login() {
  return (
    <>
      <NavBar />
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">Login</h1>
        <p>Please connect your wallet to continue.</p>
      </div>
    </>
  )
}
