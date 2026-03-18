import React from 'react';
import { motion } from 'framer-motion';

const Card = ({ children, className = '', hover = true, delay = 0, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      whileHover={
        hover
          ? { y: -5, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)" }
          : {}
      }
      className={`bg-white rounded-2xl shadow-md border border-slate-100 p-6 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;