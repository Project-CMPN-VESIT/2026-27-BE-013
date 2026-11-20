import numpy as np
import pandas as pd
import os
from sentence_transformers import SentenceTransformer

PROCESSED_DIR = "data/processed"
MODELS_DIR    = "models"
MODEL_NAME    = "all-MiniLM-L6-v2"

_model = None

def get_model():
    global _model
    if _model is None:
        print(" Loading embedding model... - embeddings.py:15")
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def compute_embeddings(topic_key: str) -> tuple:
    os.makedirs(MODELS_DIR, exist_ok=True)
    slug     = topic_key.replace(" ", "_")
    csv_path = f"{PROCESSED_DIR}/{slug}_clean.csv"
    emb_path = f"{MODELS_DIR}/{slug}_embeddings.npy"
    meta_path= f"{MODELS_DIR}/{slug}_meta.csv"

    if os.path.exists(emb_path) and os.path.exists(meta_path):
        print(f"  Embeddings cached  loading - embeddings.py:28")
        return np.load(emb_path), pd.read_csv(meta_path)

    if not os.path.exists(csv_path):
        print(f"[Notice] No CSV found for {topic_key} - embeddings.py:32")
        return None, None

    df    = pd.read_csv(csv_path)
    texts = df["text"].fillna("").tolist()

    print(f"[Embeddings] Encoding {len(texts)} texts... - embeddings.py:38")
    model      = get_model()
    embeddings = model.encode(
        texts,
        show_progress_bar=False,
        batch_size=32,
        convert_to_numpy=True,
    )

    np.save(emb_path, embeddings)
    df.to_csv(meta_path, index=False)
    print(f"[Embeddings] Saved embeddings for {topic_key} - embeddings.py:49")
    return embeddings, df