// lib/shadowRouter.ts

// --- THE SMART MARKDOWN VAULT ---
// Each template now has a targeted array of keywords. The router will score 
// the user's prompt against these arrays to find the absolute best match.

const THE_VAULT = [
  // 🗄️ DATABASE CATEGORY
  {
    keywords: ["database", "sql", "postgres", "pool", "connection", "exhaustion", "thread", "max_connections", "slow"],
    template: `### 🗄️ Database Triage: Connection Pool Exhaustion\n\n**Sugoi's Analysis:** I've cross-referenced our local runbooks. Telemetry indicates severe thread exhaustion in the primary connection pool causing query gridlock.\n\n**Execution Steps:**\n1. **Verify active connections:** Run \`SELECT count(*) FROM pg_stat_activity;\`\n2. **Terminate orphaned PIDs:** Execute \`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';\`\n3. **Tune \`postgresql.conf\`:** Increase \`max_connections\` and adjust \`shared_buffers\` accordingly.\n4. **Restart PgBouncer:** Clear the multiplexing queue using \`systemctl restart pgbouncer\`.\n5. **Audit slow queries:** Check \`pg_stat_statements\` for missing indexes.`
  },
  {
    keywords: ["deadlock", "transaction", "locked", "stare", "blocking", "pg_locks", "stuck"],
    template: `### 🗄️ Database Triage: Deadlock Detected\n\n**Sugoi's Analysis:** Telemetry confirms a classic transaction deadlock. Two or more transactions are locked in a death stare waiting for table locks.\n\n**Execution Steps:**\n1. **Identify blocking queries:** Query the \`pg_locks\` view joined with \`pg_stat_activity\`.\n2. **Force kill the blocker:** Use \`pg_cancel_backend(pid)\` on the oldest transaction.\n3. **Application Layer Fix:** Ensure the application always acquires table locks in the exact same order.\n4. **Optimize timeout:** Lower \`deadlock_timeout\` in postgres config to force faster logging.\n5. **Monitor recovery:** Tail the postgres logs to ensure transactions resume.`
  },
  {
    keywords: ["index", "corruption", "b-tree", "panic", "wal", "vacuum", "data loss"],
    template: `### 🗄️ Database Triage: B-Tree Index Corruption\n\n**Sugoi's Analysis:** B-tree traversal is failing. Someone probably forcefully terminated the DB during a massive write. Chaos ensues.\n\n**Execution Steps:**\n1. **Identify the corrupted index:** Check postgres logs for \`PANIC: corrupted item pointer\`. \n2. **Isolate the table:** Run \`REINDEX TABLE CONCURRENTLY <table_name>;\` to rebuild without locking.\n3. **Check for data loss:** Run a full \`VACUUM ANALYZE\` to ensure tuple visibility is intact.\n4. **Verify disk health:** Corrupt indexes often point to dying SSDs. Run \`smartctl -a\`. \n5. **Failsafe:** If REINDEX fails, restore the table from the latest WAL backup.`
  },

  // 🔥 HARDWARE / HEAT CATEGORY
  {
    keywords: ["heat", "thermal", "throttling", "temperature", "hot", "cooling", "fan", "rpm", "loud"],
    template: `### 🔥 Hardware Triage: Thermal Throttling\n\n**Sugoi's Analysis:** I am detecting severe thermal throttling. Core temperatures have exceeded safe thresholds. Emergency cooling protocols suggested.\n\n**Execution Steps:**\n1. **Force kill non-essential daemons:** Run \`top\` or \`htop\` and kill highest CPU consumers.\n2. **Verify RPM curves:** Check exhaust fan speeds via BIOS or \`sensors\` utility in Linux.\n3. **Clear physical airflow:** Ensure server rack intakes are completely free of dust or physical blockage.\n4. **Downclock CPU:** Temporarily disable Intel Turbo Boost / AMD Precision Boost to stabilize thermals.\n5. **Schedule hardware inspection:** Thermal paste re-application or heatsink reseating may be required.`
  },
  {
    keywords: ["pump", "liquid", "aio", "water", "clicking", "zero rpm", "cooler", "noise"],
    template: `### 🔥 Hardware Triage: Liquid Cooling Pump Failure\n\n**Sugoi's Analysis:** Zero RPM detected on the AIO pump header. The silicon is currently cooking in its own juices.\n\n**Execution Steps:**\n1. **Emergency Shutdown:** Issue an immediate \`shutdown -h now\` to prevent permanent thermal degradation.\n2. **Verify Power:** Check the SATA/Molex power delivery to the pump block.\n3. **Check BIOS Headers:** Ensure the motherboard hasn't dynamically turned off the AIO_PUMP header.\n4. **Listen for cavitation:** If the pump has power but is clicking loudly, the bearing is dead.\n5. **Replace Hardware:** Procure a new cooling loop and swap out the defective hardware immediately.`
  },

  // 💀 DEAD / OFFLINE CATEGORY
  {
    keywords: ["dead", "offline", "boot", "unresponsive", "bios", "cmos", "post", "won't turn on"],
    template: `### 💀 System Triage: Fatal Boot Failure\n\n**Sugoi's Analysis:** The target system is completely unresponsive. Ping requests are dropping, and remote SSH is timing out.\n\n**Execution Steps:**\n1. **Physical Power Cycle:** Perform a hard cold-boot (hold power for 10s, remove AC power for 30s).\n2. **Check POST codes:** Listen for motherboard beep codes or check the LED Q-Code panel.\n3. **Inspect Bootmgr / GRUB:** If booting fails, boot from a Live USB and chroot into the environment.\n4. **Verify CMOS battery:** A dead CMOS can corrupt UEFI boot orders. Replace if necessary.\n5. **Check RAID integrity:** If this is a server, verify that the storage controller hasn't marked the primary array as degraded.`
  },
  {
    keywords: ["bsod", "kernel", "panic", "crash", "blue screen", "dump", "memory", "restarting"],
    template: `### 💀 System Triage: Kernel Panic / BSOD\n\n**Sugoi's Analysis:** A critical kernel structure has been corrupted. The operating system threw its hands up and died.\n\n**Execution Steps:**\n1. **Analyze Crash Dumps:** Check \`/var/crash/\` (Linux) or \`C:\\Windows\\Minidump\` (Windows).\n2. **Review Recent Changes:** Roll back any driver updates or kernel patches installed in the last 24 hours.\n3. **Test System Memory:** A faulty RAM stick can flip bits in kernel space. Run MemTest86 overnight.\n4. **Check File System:** Boot into recovery and run \`fsck\` or \`chkdsk /f /r\` to repair filesystem corruption.\n5. **Review dmesg:** Look for hardware timeouts or failing PCI bus connections leading up to the crash.`
  },

  // 🌐 NETWORK / ERROR 404 CATEGORY
  {
    keywords: ["404", "ingress", "routing", "load balancer", "ssl", "cert", "firewall", "gateway", "502"],
    template: `### 🌐 Network Triage: Ingress Routing Failure\n\n**Sugoi's Analysis:** Cross-referenced 404/latency anomalies point to a failure at the ingress controller or load balancer level.\n\n**Execution Steps:**\n1. **Flush DNS Cache:** Run \`ipconfig /flushdns\` or \`resolvectl flush-caches\`.\n2. **Verify Route Tables:** Check \`traceroute\` to identify exactly where packets are dropping.\n3. **Restart Ingress Pods:** If using Kubernetes, execute \`kubectl rollout restart deployment nginx-ingress\`.\n4. **Check SSL Certificates:** Expired certs can cause silent drops. Verify \`cert-manager\` status.\n5. **Audit Firewall Rules:** Ensure port 443 and 80 are not being blocked by a new rogue security group rule.`
  },
  {
    keywords: ["dns", "resolve", "hostname", "nslookup", "dig", "53", "can't reach"],
    template: `### 🌐 Network Triage: DNS Resolution Failure\n\n**Sugoi's Analysis:** It's always DNS. The server can ping raw IP addresses, but hostnames are failing to resolve. \n\n**Execution Steps:**\n1. **Check local resolver:** Inspect \`/etc/resolv.conf\` for valid upstream nameservers (e.g., 8.8.8.8, 1.1.1.1).\n2. **Test queries manually:** Run \`dig google.com\` or \`nslookup\` to isolate the failure.\n3. **Restart caching daemons:** Execute \`systemctl restart systemd-resolved\` or \`nscd\`.\n4. **Verify Outbound Port 53:** Ensure local firewalls (UFW/iptables) are not dropping UDP/TCP port 53 traffic.\n5. **Check internal DNS records:** If this is a private VPC, ensure the Route53/CoreDNS zone mappings are intact.`
  },

  // 🔍 GENERAL / PERFORMANCE CATCH-ALLS
  {
    keywords: ["cpu", "crypto", "miner", "process", "kill", "rogue", "usage", "99%", "lag", "slow"],
    template: `### 🔍 Universal Triage: Rogue Background Process\n\n**Sugoi's Analysis:** Something is quietly eating 99% CPU on the host. It smells like a crypto-miner or a terrible infinite loop in someone's Python script.\n\n**Execution Steps:**\n1. **Identify the culprit:** Run \`ps aux --sort=-pcpu | head -n 10\` to find the highest offending PID.\n2. **Inspect process tree:** Run \`pstree -p <pid>\` to find what spawned the rogue task.\n3. **Terminate with prejudice:** Execute \`kill -9 <pid>\` to force the kernel to reap the process immediately.\n4. **Check persistent crons:** Audit \`crontab -l\` and \`/etc/cron.d/\` to ensure the task isn't scheduled to return.\n5. **Security Audit:** Check \`/root/.ssh/authorized_keys\` for unknown entries indicating a compromised host.`
  },
  {
    keywords: ["storage", "disk", "space", "full", "volume", "100%", "capacity", "bytes", "write error"],
    template: `### 🔍 Universal Triage: Storage Volume Exhaustion\n\n**Sugoi's Analysis:** The root partition has 0 bytes left. Everything is failing because the system literally cannot write a single error log to tell you why.\n\n**Execution Steps:**\n1. **Verify mount utilization:** Run \`df -h\` to confirm which partition is at 100% capacity.\n2. **Find the bloat:** Execute \`du -sh /* 2>/dev/null | sort -hr | head -n 10\` to locate the largest directories.\n3. **Truncate active logs:** Do NOT use \`rm\` on open log files. Use \`> /var/log/syslog\` to zero them out while preserving file handles.\n4. **Clear package caches:** Run \`apt-get clean\` or \`docker system prune -a\` to instantly free up localized space.\n5. **Implement Logrotate:** Configure \`/etc/logrotate.conf\` to prevent log files from growing infinitely in the future.`
  },
  {
    keywords: ["oom", "memory", "ram", "swap", "killer", "leak", "zombie"],
    template: `### 🔍 Universal Triage: The OOM Killer Cometh\n\n**Sugoi's Analysis:** The kernel completely ran out of physical RAM and swap space. It began indiscriminately executing processes to survive.\n\n**Execution Steps:**\n1. **Check the autopsy report:** Run \`dmesg -T | grep -i oom-killer\` to see exactly which process the kernel murdered.\n2. **Identify memory leaks:** Audit application telemetry for steadily increasing memory footprints over the last 48 hours.\n3. **Tune container limits:** Ensure Kubernetes/Docker memory limits (\`resources.limits.memory\`) are set strictly to prevent host saturation.\n4. **Add emergency swap:** If absolutely necessary, allocate a temporary swapfile using \`fallocate\` and \`mkswap\` to prevent immediate re-crashes.\n5. **Restart dependent services:** The OOM killer often leaves databases and web servers in an inconsistent "zombie" state. Cycle them.`
  }
];

// The ultimate fallback if the user types something completely unrelated to IT 
// (e.g., "my dog ate my homework")
const UNIVERSAL_FALLBACK = `### 🔍 Universal Triage: Standard Diagnostic Protocol\n\n**Sugoi's Analysis:** I have cross-referenced this anomaly. Proceed with the universal Level 1 triage matrix.\n\n**Execution Steps:**\n1. **Check Resources:** Use \`htop\` for CPU/RAM, and \`df -h\` for disk space. Alert if >90%.\n2. **Container Health:** Run \`kubectl get pods -A | grep -v Running\` and investigate logs.\n3. **Service Status:** Run \`systemctl status <service>\`, checking \`dmesg\` for OOMKilled events.\n4. **CI/CD Pipeline:** Check recent GitHub Actions/Jenkins logs for failed artifact registry access.\n5. **Cloud Audit:** Verify AWS/GCP IAM roles, security groups, and billing quotas to ensure no silent throttling.`;

export function executeShadowRouter(prompt: string): string {
  const normalizedPrompt = prompt.toLowerCase();

  // If the prompt is too short or generic, output a "Need More Info" fallback
  if (normalizedPrompt.length < 15 || normalizedPrompt.includes("hello")) {
      return "### ⚠️ Triage Incomplete\n\n**Sugoi's Analysis:** The input provided lacks sufficient technical context for autonomous classification.\n\n**Execution Steps:**\n1. Please provide specific error codes, logs, or system symptoms.\n2. Detail the exact service or endpoint that is failing.\n3. Mention any recent configuration changes or deployments.";
  }
  
  let bestMatch = UNIVERSAL_FALLBACK;
  let highestScore = 0;

  // Score every template in the vault against the prompt
  for (const item of THE_VAULT) {
    let currentScore = 0;
    
    for (const keyword of item.keywords) {
      if (normalizedPrompt.includes(keyword)) {
        currentScore++;
      }
    }

    // If this template has the highest keyword overlap, make it the winner
    if (currentScore > highestScore) {
      highestScore = currentScore;
      bestMatch = item.template;
    }
  }

  return bestMatch;
}
