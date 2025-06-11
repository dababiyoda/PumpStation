import Link from 'next/link'

export default function NavBar() {
  return (
    <nav className="p-4 bg-gray-200 flex gap-4">
      <Link href="/">Home</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/vote">Vote</Link>
      <Link href="/login">Login</Link>
    </nav>
  )
}
