import json
import os
import csv
import io
import sys
# Force disable PyTorch dynamo to prevent MemoryError during import
os.environ["TORCH_COMPILE_DISABLE"] = "1"
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

from sentence_transformers import SentenceTransformer
from sklearn.neural_network import MLPClassifier

def train():
    print("Loading dataset...")
    file_path = '../data/merged_tickets.csv'
    
    # Map categories to integer labels
    categories = ['Application', 'Database', 'Network', 'Access Management', 'Infrastructure', 'Security']
    category_to_id = {cat: i for i, cat in enumerate(categories)}
    id2cat = {i: c for c, i in enumerate(categories)}

    texts = []
    labels = []
    
    print("Parsing CSV via standard library to conserve memory...")
    # Increase CSV field size limit
    csv.field_size_limit(sys.maxsize)
    
    category_mapping = {
        'Application': 'Application',
        'Infrastructure': 'Infrastructure',
        'Security': 'Security',
        'Database': 'Database',
        'Network': 'Network',
        'Access Management': 'Access Management',
        'Technical Support': 'Application',
        'IT Support': 'Infrastructure',
        'Service Outages and Maintenance': 'Network',
        'Human Resources': 'Access Management',
        'Product Support': 'Application'
    }
    
    category_counts = {cat: 0 for cat in categories}
    MAX_PER_CATEGORY = 1000

    print("Loading all tickets into memory for deterministic shuffling...")
    all_rows = []
    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            all_rows.append(row)

    import random
    # Shuffle deterministically with a fixed seed so the cache remains stable
    random.seed(42)
    random.shuffle(all_rows)

    for row in all_rows:
        raw_queue = row.get('Queue', '')
        mapped_cat = category_mapping.get(raw_queue)
        if mapped_cat and category_counts[mapped_cat] < MAX_PER_CATEGORY:
            subj = row.get('Subject', '') or ''
            body = row.get('Body', '') or ''
            text = subj + " " + body
            if text.strip():
                texts.append(text)
                labels.append(category_to_id[mapped_cat])
                category_counts[mapped_cat] += 1

    print(f"Loaded {len(texts)} balanced IT tickets (max {MAX_PER_CATEGORY} per class, shuffled).")
    print("Loading embedding model (BAAI/bge-small-en-v1.5)...")
    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    import numpy as np
    emb_cache = '../data/embeddings_cache_shuffled.npy'
    # Delete stale cache if dataset has changed
    if os.path.exists(emb_cache):
        cache_size = os.path.getsize(emb_cache)
        expected_size = len(texts) * 384 * 4  # float32 = 4 bytes
        if abs(cache_size - expected_size) > expected_size * 0.1:
            print("Embeddings cache is stale (dataset size changed). Regenerating...")
            os.remove(emb_cache)
    
    if os.path.exists(emb_cache):
        print("Loading embeddings from cache...")
        X = np.load(emb_cache)
    else:
        import gc
        import torch
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        print(f"Generating embeddings for {len(texts)} training samples in chunks of 500...")
        chunk_size = 500
        embeddings_list = []
        for start_idx in range(0, len(texts), chunk_size):
            chunk_texts = texts[start_idx:start_idx + chunk_size]
            print(f"  Encoding chunk {start_idx // chunk_size + 1}/{(len(texts) + chunk_size - 1) // chunk_size}...")
            with torch.no_grad():
                chunk_embeddings = model.encode(chunk_texts, batch_size=8, show_progress_bar=False, normalize_embeddings=True)
            embeddings_list.append(chunk_embeddings)
            del chunk_embeddings
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
        X = np.vstack(embeddings_list)
        np.save(emb_cache, X)
    
    y = np.array(labels)

    print("Training Multi-Layer Perceptron classifier...")
    clf = MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42)
    clf.fit(X, y)

    score = clf.score(X, y)
    print(f"Training Accuracy: {score:.4f}")

    # ═══════════════════════════════════════════════════════════
    # Export 1: JSON Weights (MLP forward pass serialization)
    # ═══════════════════════════════════════════════════════════
    print("Exporting Weights and Intercepts to JSON...")
    
    weights = [w.tolist() for w in clf.coefs_]
    intercepts = [b.tolist() for b in clf.intercepts_]

    export_data = {
        "classes": categories,
        "weights": weights,
        "intercepts": intercepts
    }

    output_path = '../data/lr_model.json'
    with open(output_path, 'w') as f:
        json.dump(export_data, f)
        
    print(f"[OK] JSON weights exported to {output_path}")

    # ═══════════════════════════════════════════════════════════
    # Export 2: ONNX Model (C++ accelerated inference)
    # ═══════════════════════════════════════════════════════════
    try:
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType

        print("Exporting Model to ONNX...")
        # Define the input shape: 1 sample, 384 dimensions (from bge-small)
        initial_type = [('float_input', FloatTensorType([None, 384]))]
        onnx_model = convert_sklearn(
            clf, 
            initial_types=initial_type, 
            target_opset=12,
            options={id(clf): {'zipmap': False}}
        )

        onnx_output = '../public/models/classifier.onnx'
        os.makedirs(os.path.dirname(onnx_output), exist_ok=True)
        with open(onnx_output, "wb") as f:
            f.write(onnx_model.SerializeToString())

        print(f"[OK] ONNX model exported to {onnx_output}")

        # Also export the class mapping for the ONNX session
        class_map_path = '../public/models/class_map.json'
        with open(class_map_path, 'w') as f:
            json.dump({"classes": categories, "id2cat": id2cat}, f)
        print(f"[OK] Class mapping exported to {class_map_path}")

    except ImportError:
        print("[WARN] skl2onnx not installed. Skipping ONNX export.")
        print("  Install with: pip install skl2onnx onnxruntime")

if __name__ == "__main__":
    # Ensure run from the scripts dir
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    train()
