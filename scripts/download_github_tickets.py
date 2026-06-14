"""
download_github_tickets.py — Dataset ETL & Merge Pipeline
==========================================================
Downloads the Kaggle `tobiasbueck/helpdesk-github-tickets` dataset,
normalizes its schema, maps GitHub labels → system categories,
merges with the existing `english_tickets.csv`, and exports
`data/merged_tickets.csv` for training, evaluation, and RAG.

Usage:
    pip install kagglehub pandas
    python scripts/download_github_tickets.py
"""

import os
import sys
import hashlib
import io

# Fix Windows terminal encoding for emoji support
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import pandas as pd

# Ensure run from the scripts dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# ═══════════════════════════════════════════════════════════════════
# 1. DOWNLOAD THE GITHUB TICKETS DATASET
# ═══════════════════════════════════════════════════════════════════

def download_dataset():
    """Download the dataset via kagglehub and return the local path."""
    try:
        import kagglehub
        print("📥 Downloading tobiasbueck/helpdesk-github-tickets from Kaggle...")
        path = kagglehub.dataset_download("tobiasbueck/helpdesk-github-tickets")
        print(f"   ✅ Downloaded to: {path}")
        return path
    except ImportError:
        print("❌ kagglehub not installed. Install with: pip install kagglehub")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Download failed: {e}")
        print("   Make sure you have Kaggle API credentials configured.")
        print("   See: https://github.com/Kaggle/kagglehub#authenticate")
        sys.exit(1)

# ═══════════════════════════════════════════════════════════════════
# 2. LABEL → CATEGORY MAPPING (Keyword Heuristics)
# ═══════════════════════════════════════════════════════════════════

# Priority-ordered rules: first match wins
LABEL_RULES = [
    # Security — check first since security issues are critical
    {
        "keywords": ["security", "vulnerability", "cve", "auth", "authentication",
                      "authorization", "xss", "csrf", "injection", "exploit",
                      "malware", "encryption", "certificate", "ssl", "tls",
                      "token", "oauth", "credentials", "breach", "sanitize"],
        "category": "Security"
    },
    # Database
    {
        "keywords": ["database", "sql", "query", "migration", "postgres",
                      "mysql", "mongodb", "redis", "sqlite", "schema",
                      "index", "table", "orm", "sequelize", "prisma",
                      "typeorm", "knex", "deadlock", "transaction"],
        "category": "Database"
    },
    # Network
    {
        "keywords": ["network", "dns", "http", "api", "connection", "timeout",
                      "socket", "proxy", "cors", "websocket", "tcp", "udp",
                      "ssl", "cert", "load-balancer", "ingress", "routing",
                      "latency", "bandwidth", "firewall", "502", "503", "504",
                      "404", "gateway", "request", "response", "endpoint", "rest",
                      "graphql", "grpc", "url", "fetch", "axios"],
        "category": "Network"
    },
    # Access Management
    {
        "keywords": ["access", "permission", "role", "user", "login", "logout",
                      "signup", "register", "password", "rbac", "acl", "admin",
                      "privilege", "denied", "forbidden", "403", "unauthorized",
                      "401", "sso", "ldap", "saml", "invite", "onboarding"],
        "category": "Access Management"
    },
    # Infrastructure
    {
        "keywords": ["infra", "deploy", "server", "docker", "k8s", "kubernetes",
                      "ci", "cd", "pipeline", "build", "compile", "container",
                      "vm", "cloud", "aws", "gcp", "azure", "terraform",
                      "ansible", "nginx", "apache", "scaling", "cluster",
                      "node", "pod", "helm", "devops", "monitoring",
                      "prometheus", "grafana", "log", "disk", "memory",
                      "cpu", "oom", "crash", "performance", "slow"],
        "category": "Infrastructure"
    },
    # Application (broadest catch — checked last)
    {
        "keywords": ["bug", "error", "fix", "feature", "enhancement", "ui",
                      "ux", "frontend", "backend", "component", "render",
                      "display", "layout", "style", "css", "javascript",
                      "typescript", "react", "vue", "angular", "test",
                      "documentation", "docs", "refactor", "improvement",
                      "update", "upgrade", "deprecat", "breaking", "config",
                      "setting", "option", "param", "input", "output",
                      "validation", "format", "parse", "serialize"],
        "category": "Application"
    },
]

def map_labels_to_category(labels_str, title="", body=""):
    """
    Map GitHub labels to one of the 6 system categories using keyword heuristics.
    Falls back to title/body content analysis if labels are empty.
    """
    # Combine all text for matching
    search_text = ""
    
    if isinstance(labels_str, str) and labels_str.strip():
        search_text += labels_str.lower() + " "
    
    # Also check title and body for keyword matches
    if isinstance(title, str):
        search_text += title.lower() + " "
    if isinstance(body, str):
        # Only use first 500 chars of body to avoid noise
        search_text += body[:500].lower() + " "
    
    if not search_text.strip():
        return "Infrastructure"  # Default
    
    # Score each category
    best_category = "Application"  # Default fallback
    best_score = 0
    
    for rule in LABEL_RULES:
        score = sum(1 for kw in rule["keywords"] if kw in search_text)
        if score > best_score:
            best_score = score
            best_category = rule["category"]
    
    return best_category

# ═══════════════════════════════════════════════════════════════════
# 3. PRIORITY MAPPING
# ═══════════════════════════════════════════════════════════════════

def infer_priority(labels_str, title=""):
    """Infer priority from labels and title keywords."""
    text = f"{labels_str} {title}".lower() if isinstance(labels_str, str) else str(title).lower()
    
    if any(kw in text for kw in ["critical", "urgent", "blocker", "p0", "sev-0", "sev-1", "emergency"]):
        return "Critical"
    elif any(kw in text for kw in ["high", "important", "p1", "sev-2", "major"]):
        return "High"
    elif any(kw in text for kw in ["low", "minor", "trivial", "p3", "cosmetic", "nice-to-have"]):
        return "Low"
    else:
        return "Medium"

# ═══════════════════════════════════════════════════════════════════
# 4. SCHEMA NORMALIZATION & MERGE
# ═══════════════════════════════════════════════════════════════════

def normalize_github_dataset(dataset_path):
    """Load and normalize the GitHub tickets dataset to match english_tickets.csv schema."""
    print("\n📋 Normalizing GitHub tickets dataset...")
    
    # Find CSV/parquet files in the downloaded path
    data_files = []
    for root, dirs, files in os.walk(dataset_path):
        for f in files:
            if f.endswith(('.csv', '.parquet', '.json')):
                data_files.append(os.path.join(root, f))
    
    if not data_files:
        print(f"❌ No data files found in {dataset_path}")
        sys.exit(1)
    
    print(f"   Found files: {[os.path.basename(f) for f in data_files]}")
    
    # Load all data files and concatenate
    dfs = []
    for fpath in data_files:
        try:
            if fpath.endswith('.csv'):
                df = pd.read_csv(fpath, on_bad_lines='skip')
            elif fpath.endswith('.parquet'):
                df = pd.read_parquet(fpath)
            elif fpath.endswith('.json'):
                df = pd.read_json(fpath)
            dfs.append(df)
            print(f"   Loaded {os.path.basename(fpath)}: {len(df)} rows, columns: {list(df.columns)}")
        except Exception as e:
            print(f"   ⚠ Skipping {os.path.basename(fpath)}: {e}")
    
    if not dfs:
        print("❌ No data files could be loaded.")
        sys.exit(1)
    
    # Use the largest dataframe as the primary source
    df = max(dfs, key=len)
    print(f"\n   Using primary dataframe: {len(df)} rows")
    print(f"   Columns: {list(df.columns)}")
    
    # ── Column detection (flexible matching) ──
    # The dataset may have varying column names. We detect them.
    col_map = {}
    cols_lower = {c.lower().strip(): c for c in df.columns}
    
    # Title/Subject column
    for candidate in ['issues question', 'issue', 'title', 'subject', 'question', 'name']:
        if candidate in cols_lower:
            col_map['title'] = cols_lower[candidate]
            break
    
    # Body/Description column  
    for candidate in ['body', 'description', 'content', 'text', 'detail', 'details']:
        if candidate in cols_lower:
            col_map['body'] = cols_lower[candidate]
            break
    
    # Answer/Resolution column
    for candidate in ['answers/comments', 'answer', 'answers', 'comments', 'response', 'resolution', 'comment']:
        if candidate in cols_lower:
            col_map['answer'] = cols_lower[candidate]
            break
    
    # Labels column
    for candidate in ['labels', 'label', 'tags', 'categories', 'category']:
        if candidate in cols_lower:
            col_map['labels'] = cols_lower[candidate]
            break
    
    # Repo name column
    for candidate in ['repo name', 'repo', 'repository', 'project']:
        if candidate in cols_lower:
            col_map['repo'] = cols_lower[candidate]
            break
    
    print(f"   Column mapping: {col_map}")
    
    # ── Build normalized dataframe ──
    rows = []
    skipped = 0
    
    for _, row in df.iterrows():
        title = str(row.get(col_map.get('title', ''), '')) if col_map.get('title') else ''
        body = str(row.get(col_map.get('body', ''), '')) if col_map.get('body') else ''
        answer = str(row.get(col_map.get('answer', ''), '')) if col_map.get('answer') else ''
        labels = str(row.get(col_map.get('labels', ''), '')) if col_map.get('labels') else ''
        repo = str(row.get(col_map.get('repo', ''), '')) if col_map.get('repo') else ''
        
        # Skip rows with no meaningful content
        if (not title or title == 'nan') and (not body or body == 'nan'):
            skipped += 1
            continue
        
        # Clean nan strings
        title = '' if title == 'nan' else title
        body = '' if body == 'nan' else body
        answer = '' if answer == 'nan' else answer
        labels = '' if labels == 'nan' else labels
        repo = '' if repo == 'nan' else repo
        
        # Prepend repo context to body if available
        if repo:
            body = f"[Repo: {repo}] {body}"
        
        # Map to category
        category = map_labels_to_category(labels, title, body)
        priority = infer_priority(labels, title)
        
        rows.append({
            'Subject': title.strip()[:500],  # Cap at 500 chars
            'Body': body.strip()[:2000],       # Cap at 2000 chars
            'Answer': answer.strip()[:3000],   # Cap at 3000 chars
            'Type': 'GitHub Issue',
            'Queue': category,                 # Already mapped to system categories
            'Priority': priority,
            'Language': 'en'
        })
    
    github_df = pd.DataFrame(rows)
    print(f"   ✅ Normalized {len(github_df)} GitHub tickets ({skipped} skipped)")
    
    return github_df

def load_existing_dataset():
    """Load the existing english_tickets.csv and normalize its Queue column."""
    existing_path = '../data/english_tickets.csv'
    
    if not os.path.exists(existing_path):
        print("   ⚠ english_tickets.csv not found. Using only GitHub tickets.")
        return pd.DataFrame()
    
    print("\n📋 Loading existing english_tickets.csv...")
    df = pd.read_csv(existing_path, on_bad_lines='skip')
    print(f"   Loaded {len(df)} rows")
    
    # Apply the same category mapping used in train_lr.py
    category_mapping = {
        'Technical Support': 'Application',
        'IT Support': 'Infrastructure',
        'Service Outages and Maintenance': 'Network',
        'Human Resources': 'Access Management',
        'Billing and Payments': 'DROP',
        'Customer Service': 'DROP',
        'Returns and Exchanges': 'DROP',
        'Sales and Pre-Sales': 'DROP',
        'Product Support': 'Application',
        'General Inquiry': 'DROP'
    }
    
    df['Queue'] = df['Queue'].map(category_mapping)
    df = df[df['Queue'] != 'DROP']
    df = df.dropna(subset=['Queue'])
    
    # Ensure consistent columns
    for col in ['Subject', 'Body', 'Answer', 'Type', 'Queue', 'Priority', 'Language']:
        if col not in df.columns:
            df[col] = ''
    
    df = df[['Subject', 'Body', 'Answer', 'Type', 'Queue', 'Priority', 'Language']]
    df = df.fillna('')
    
    print(f"   ✅ {len(df)} IT-relevant tickets after category filtering")
    return df

def deduplicate(df):
    """Deduplicate on Subject+Body hash."""
    print("\n🔄 Deduplicating merged dataset...")
    original_len = len(df)
    
    df['_hash'] = df.apply(
        lambda r: hashlib.md5(
            f"{str(r.get('Subject', ''))[:200]}{str(r.get('Body', ''))[:200]}".encode()
        ).hexdigest(),
        axis=1
    )
    df = df.drop_duplicates(subset='_hash', keep='first')
    df = df.drop(columns=['_hash'])
    
    removed = original_len - len(df)
    print(f"   Removed {removed} duplicates ({len(df)} unique tickets remain)")
    return df

# ═══════════════════════════════════════════════════════════════════
# 5. MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  SUGOI BOT v5.0 — Dataset Engineering Pipeline")
    print("=" * 60)
    
    # 1. Download
    dataset_path = download_dataset()
    
    # 2. Normalize GitHub tickets
    github_df = normalize_github_dataset(dataset_path)
    
    # 3. Load existing dataset
    existing_df = load_existing_dataset()
    
    # 4. Merge
    print("\n🔗 Merging datasets...")
    if len(existing_df) > 0:
        merged_df = pd.concat([existing_df, github_df], ignore_index=True)
    else:
        merged_df = github_df
    print(f"   Combined: {len(merged_df)} total rows")
    
    # 5. Deduplicate
    merged_df = deduplicate(merged_df)
    
    # 6. Export
    output_path = '../data/merged_tickets.csv'
    merged_df.to_csv(output_path, index=False)
    print(f"\n💾 Exported to: {output_path}")
    
    # 7. Statistics
    print("\n" + "=" * 60)
    print("  📊 MERGED DATASET STATISTICS")
    print("=" * 60)
    print(f"\n  Total tickets: {len(merged_df)}")
    print(f"\n  Category Distribution:")
    cat_counts = merged_df['Queue'].value_counts()
    for cat, count in cat_counts.items():
        pct = count / len(merged_df) * 100
        bar = "█" * int(pct / 2)
        print(f"    {cat:25s} │ {count:6d} ({pct:5.1f}%) {bar}")
    
    print(f"\n  Priority Distribution:")
    pri_counts = merged_df['Priority'].value_counts()
    for pri, count in pri_counts.items():
        print(f"    {pri:25s} │ {count:6d}")
    
    print(f"\n  Source Distribution:")
    type_counts = merged_df['Type'].value_counts()
    for t, count in type_counts.items():
        print(f"    {str(t):25s} │ {count:6d}")
    
    # Check for tickets with answers (important for RAG & evaluation)
    has_answer = merged_df['Answer'].apply(lambda x: isinstance(x, str) and len(x.strip()) > 10).sum()
    print(f"\n  Tickets with resolutions: {has_answer} ({has_answer/len(merged_df)*100:.1f}%)")
    
    print("\n✅ Dataset engineering complete!")
    print("   Next steps:")
    print("   1. python scripts/train_lr.py     (retrain classifier)")
    print("   2. node scripts/seed_database.mjs  (re-seed Supabase)")

if __name__ == "__main__":
    main()
