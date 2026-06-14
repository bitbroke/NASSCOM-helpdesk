import pandas as pd
import json
import os
import dspy
from dspy.teleprompt import BootstrapFewShot

# Ensure run from the scripts dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# ─── DSPy Setup ──────────────────────────────────────────────────────────
# Configure the Language Models for DSPy
# We use Groq as the fast generator, and potentially a larger model as the judge.
groq_api_key = os.environ.get("GROQ_API_KEY")

if not groq_api_key:
    print("❌ GROQ_API_KEY environment variable is required.")
    exit(1)

# Set up the Groq Llama 3 model in DSPy
lm = dspy.LM('openai/llama-3.3-70b-versatile', api_key=groq_api_key, base_url='https://api.groq.com/openai/v1')
dspy.settings.configure(lm=lm)

# ─── 1. Define the Signature ─────────────────────────────────────────────
class ResolveITIssue(dspy.Signature):
    """Diagnose an IT issue and provide a highly technical markdown runbook resolution."""
    issue_description = dspy.InputField(desc="The raw IT issue description and logs.")
    category = dspy.InputField(desc="The system category (e.g., Network, Database, Infrastructure).")
    
    diagnosis = dspy.OutputField(desc="Structured root-cause diagnosis.")
    runbook = dspy.OutputField(desc="A markdown-formatted technical runbook to resolve the issue.")

class TriageAgent(dspy.Module):
    def __init__(self):
        super().__init__()
        # We use ChainOfThought which automatically adds the <thinking> constraint inside DSPy
        self.generate_resolution = dspy.ChainOfThought(ResolveITIssue)

    def forward(self, issue_description, category):
        prediction = self.generate_resolution(issue_description=issue_description, category=category)
        return prediction

# ─── 2. Define the Metric (Constraint-Based LLM-as-a-Judge) ─────────────
def runbook_metric(example, pred, trace=None):
    """
    Evaluates the quality of the generated runbook against the ground truth.
    Checks for: Length, Technical Density (Markdown), and Semantic overlap.
    """
    # 1. Structural Constraints
    has_markdown_blocks = "```" in pred.runbook
    has_lists = "-" in pred.runbook or "*" in pred.runbook
    has_rollback = any(kw in pred.runbook.lower() for kw in ['rollback', 'revert', 'undo', 'restore', 'backup'])
    has_verification = any(kw in pred.runbook.lower() for kw in ['verify', 'confirm', 'check', 'validate', 'test'])
    
    # 2. Heuristic LLM Judge — keyword overlap with ground truth
    truth_keywords = set([w.lower() for w in example.truth_resolution.split() if len(w) > 4])
    pred_keywords = set([w.lower() for w in pred.runbook.split() if len(w) > 4])
    
    overlap = len(truth_keywords.intersection(pred_keywords))
    density_score = min(1.0, overlap / (len(truth_keywords) + 1))
    
    score = 0.0
    if has_markdown_blocks: score += 0.2
    if has_lists: score += 0.15
    if has_rollback: score += 0.15  # Rollback plan presence (new)
    if has_verification: score += 0.1  # Verification step presence (new)
    score += (density_score * 0.4)
    
    return score >= 0.65  # Slightly stricter threshold

# ─── 3. Load Dataset ─────────────────────────────────────────────────────
def load_data():
    print("Loading merged_tickets.csv dataset for DSPy optimization...")
    csv_path = '../data/merged_tickets.csv'
    if not os.path.exists(csv_path):
        print('⚠ merged_tickets.csv not found. Falling back to english_tickets.csv')
        csv_path = '../data/english_tickets.csv'
    df = pd.read_csv(csv_path, on_bad_lines='skip')
    df = df.dropna(subset=['Subject', 'Body', 'Answer', 'Queue'])
    
    category_mapping = {
        # Direct mappings (merged_tickets.csv already has these)
        'Application': 'Application',
        'Infrastructure': 'Infrastructure',
        'Security': 'Security',
        'Database': 'Database',
        'Network': 'Network',
        'Access Management': 'Access Management',
        # Legacy mappings from english_tickets.csv
        'Technical Support': 'Application',
        'IT Support': 'Infrastructure',
        'Service Outages and Maintenance': 'Network',
        'Human Resources': 'Access Management',
        'Product Support': 'Application',
    }
    df['Mapped_Category'] = df['Queue'].map(category_mapping)
    df = df.dropna(subset=['Mapped_Category'])
    
    # Take a larger random sample for DSPy teleprompting
    sample = df.sample(n=min(48, len(df)), random_state=42)
    
    trainset = []
    for _, row in sample.iterrows():
        issue_text = f"Subject: {row['Subject']}\nBody: {row['Body']}"
        trainset.append(dspy.Example(
            issue_description=issue_text,
            category=row['Mapped_Category'],
            truth_resolution=row['Answer']
        ).with_inputs('issue_description', 'category'))
        
    return trainset

# ─── 4. Run Optimization ─────────────────────────────────────────────────
def optimize():
    trainset = load_data()
    print(f"Loaded {len(trainset)} examples. Bootstrapping few-shot prompt optimizer...")

    # The Teleprompter
    teleprompter = BootstrapFewShot(
        metric=runbook_metric,
        max_bootstrapped_demos=3,
        max_labeled_demos=3
    )

    # Compile the optimized agent
    agent = TriageAgent()
    optimized_agent = teleprompter.compile(agent, trainset=trainset)

    # Export the optimized prompts
    print("\n✅ Optimization Complete. Exporting compiled agent...")
    optimized_agent.save('../data/dspy_optimized_prompts.json')
    
    print("\nHere is the newly mathematically optimized prompt instruction generated by DSPy:")
    # We can inspect the internal generated instructions
    print(optimized_agent.generate_resolution.signature.instructions)
    print("\nThe Next.js app can now read from `data/dspy_optimized_prompts.json` to inject these optimized few-shot examples automatically!")

if __name__ == "__main__":
    optimize()
