import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickTipProps {
  id: string;
  message: string;
}

export const QuickTip: React.FC<QuickTipProps> = ({ id, message }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(`hoimu_quick_tip_${id}`);
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, [id]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(`hoimu_quick_tip_${id}`, 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="m-4 p-3 rounded-2xl bg-[#E9C46A]/20 border border-[#E9C46A]/50 text-[#588157] flex items-start gap-3 shadow-sm relative overflow-hidden"
        >
          <div className="mt-0.5 shrink-0">
            <Info className="w-4 h-4 text-[#E76F51]" />
          </div>
          <p className="text-[13px] font-medium leading-tight flex-1 pr-4">
            {message}
          </p>
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5 opacity-70" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
