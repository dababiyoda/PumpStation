import '@/styles/globals.css'
import { useEffect, useState } from 'react'
import Web3 from 'web3'

function MyApp({ Component, pageProps }) {
  const [web3, setWeb3] = useState(null)
  const [account, setAccount] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const web3Instance = new Web3(window.ethereum)
      setWeb3(web3Instance)
      window.ethereum.request({ method: 'eth_requestAccounts' }).then((accounts) => {
        setAccount(accounts[0])
      })
    }
  }, [])

  return <Component {...pageProps} web3={web3} account={account} />
}

export default MyApp
