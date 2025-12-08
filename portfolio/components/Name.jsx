import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const finished = `
><<   ><<        ><            ><<
><<  ><<        >< <<          ><<
><< ><<        ><  ><<         ><<
>< ><         ><<   ><<        ><<
><<  ><<     ><<<<<<>><<       ><<
><<   ><<   ><<       ><< ><   ><<
><<     ><<><<         ><< ><<<<  
`;

const initial = finished.replace(/  /g, '>>').replace(/ /g, '<');

export function Name({ onDone }) {
  const [name, setName] = useState(initial);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (name === finished) return;

    const interval = setInterval(() => {
      const indexes = finished.split('').reduce((acc, char, i) => {
        if (char === ' ' && name[i] !== ' ' && name[i] !== '\n') acc.push(i);
        return acc;
      }, []);

      const index = indexes[Math.floor(Math.random() * indexes.length)];

      setName((prev) => {
        const arr = prev.split('');
        arr[index] = ' ';
        return arr.join('');
      });

      if (indexes.length === 1 && !done) {
        onDone();
        setDone(true);
        return;
      };
    }, 10);

    return () => clearInterval(interval);
  }, [done, name, onDone]);

  return (
    <motion.p layout="preserve-aspect" layoutId='name' className="font-mono whitespace-pre-wrap text-center font-bold sm:text-base text-xs">
      {name}
    </motion.p>
  );
}