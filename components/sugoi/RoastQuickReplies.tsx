"use client";

import { motion } from "framer-motion";
import { useSugoiStore } from "@/store/useSugoiStore";
import toast from "react-hot-toast";

interface RoastQuickRepliesProps {
  onSelect: (text: string) => void;
}

export function RoastQuickReplies({ onSelect }: RoastQuickRepliesProps) {
  const setMood = useSugoiStore((state) => state.setMood);

  const options = [
    {
      label: "🌐 VPN timeout",
      text: "VPN keeps disconnecting after 2 minutes. Error: TLS handshake timeout. Tried reconnecting 5 times, getting ERR_CONNECTION_TIMED_OUT on internal services.",
      action: () => { setMood("judging"); toast("Routing to Network team...", { icon: "📡" }); },
    },
    {
      label: "🗄️ DB pool exhausted",
      text: "PostgreSQL connection pool exhausted in production. Getting 'FATAL: too many connections for role postgres'. Response times spiked to 12s. Currently 340/350 max connections used.",
      action: () => { setMood("glowing-eyes"); toast("Critical DB alert triggered.", { icon: "🔥" }); },
    },
    {
      label: "🔐 LDAP auth failing",
      text: "Users unable to log in since 9 AM. LDAP bind failing with error 49 - Invalid Credentials. AD sync shows last successful replication 14 hours ago. Affects ~200 users.",
      action: () => { setMood("thinking"); toast("Authentication issue detected.", { icon: "🔐" }); },
    },
    {
      label: "📜 SSL cert expired",
      text: "Production API returning ERR_CERT_DATE_INVALID. Certificate for api.company.com expired yesterday. All downstream microservices returning 502. Need emergency renewal.",
      action: () => { setMood("crying"); toast("Certificate emergency!", { icon: "⚠️" }); },
    },
    {
      label: "💀 OOM kill in K8s",
      text: "Pod restarting every 3 minutes. kubectl logs show: OOMKilled - container exceeded 2Gi memory limit. Java heap dump shows memory leak in connection pooling. 3 pods affected.",
      action: () => { setMood("dead-inside"); toast("Infrastructure alert.", { icon: "💀" }); },
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt, idx) => (
        <motion.button key={idx}
          whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(212,160,23,0.15)" }}
          whileTap={{ scale: 0.97, y: 0 }}
          onClick={() => { opt.action(); onSelect(opt.text); }}
          className="text-[11px] font-semibold py-2 px-3.5 rounded-full transition-all cursor-pointer glass-inner hover:bg-white/60"
          style={{ color: "var(--soft-black)", border: "1px solid rgba(212,160,23,0.12)" }}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}
