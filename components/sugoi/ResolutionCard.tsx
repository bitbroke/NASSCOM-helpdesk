import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface ResolutionCardProps {
  resolutionText: string;
}

export function ResolutionCard({ resolutionText }: ResolutionCardProps) {
  if (!resolutionText) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      // Full width, minimum height, perfect glassmorphism
      className="w-full min-h-[300px] mt-4 bg-white/50 backdrop-blur-2xl border border-white shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] rounded-3xl p-6 md:p-8 relative z-20"
    >
      <div className="flex items-center gap-3 mb-6 border-b border-amber-200/50 pb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white shadow-md">
          ✨
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-800">
          Sugoi's Diagnostic Runbook
        </h2>
      </div>

      {/* Added leading-relaxed for line height, and prose-ol/prose-li for list formatting */}
      <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed
                      prose-headings:text-slate-900 prose-headings:font-bold 
                      prose-a:text-amber-600 prose-strong:text-amber-700 
                      prose-ol:list-decimal prose-ol:pl-5 prose-li:my-1 prose-li:pl-1
                      prose-code:bg-amber-50 prose-code:text-amber-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown>{resolutionText}</ReactMarkdown>
      </div>
    </motion.div>
  );
}
