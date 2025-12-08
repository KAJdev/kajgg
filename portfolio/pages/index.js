import Head from 'next/head';
import { useState, useEffect } from 'react';
import { Name } from '../components/Name';
import styles from '../styles/Home.module.css';
import { motion } from 'framer-motion';

export default function Home() {
  const [showStuff, setShowStuff] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => console.log("There's always another secret..."), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Kaj</title>
        <meta name="description" content="Hey, I'm kaj! Check me out!" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className='w-9/10 sm:w-[40em] text-left'>
          <Name onDone={() => setShowStuff(true)} />

          {showStuff && (
            <motion.div 
              className='mt-5 font-mono' 
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                type: 'spring',
                stiffness: 100,
                damping: 20,
                restSpeed: 0.005,
              }}
            >
              <p className='text-center w-full'>
                A <span className='text-green-500'>developer</span> & <span className='text-green-500'>designer</span> building @ <a className='text-indigo-500 hover:underline' href="https://runpod.io" target='_blank' rel="noreferrer">RunPod</a>
              </p>

              <motion.div
                className='flex flex-row justify-center gap-3 mt-16'
                initial={{
                  opacity: 0,
                  y: 20
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 20,
                  restSpeed: 0.005,
                  delay: 0.1
                }}
              >
                <a className='text-blue-500 hover:underline' href="https://github.com/kajdev" target='_blank' rel="noreferrer">GitHub</a>
                <span className='text-blue-500/30'>•</span>
                <a className='text-blue-500 hover:underline' href="https://twitter.com/KAJ718" target='_blank' rel="noreferrer">Twitter</a>
              </motion.div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}
