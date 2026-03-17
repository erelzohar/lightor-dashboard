import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import { useState } from "react";

interface FieldTooltipProps {
  title: string;
  description: string;
  image?: string;
}

export default function FieldTooltip({
  title,
  description,
  image,
}: FieldTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-block mx-2"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Info size={16} className="text-gray-400 hover:text-gray-600 cursor-help" />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="
              absolute z-50 w-64 right-[-5.5rem] bottom-full mb-2
              bg-white border border-gray-200
              rounded-xl shadow-lg p-4
            "
          >
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-2 leading-5">{description}</p>

            {image && (
              <img
                src={image}
                alt="tooltip"
                className="mt-3 rounded-md border w-full max-h-40 object-cover"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
