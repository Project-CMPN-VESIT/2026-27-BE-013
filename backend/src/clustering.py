import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

SIMILARITY_THRESHOLD = 0.70
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_st_model = None

def get_st_model():
    global _st_model
    if _st_model is None:
        _st_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _st_model

def cluster_claims(claims: list, threshold: float = SIMILARITY_THRESHOLD) -> dict:
    """
    Groups semantically related claims using normalized embeddings & cosine similarity.
    Allows an explicit unclustered/noise category.
    Labels are generated from actual member claim content.
    """
    if not claims:
        return {
            "clusters": [],
            "unclustered": [],
            "clustering_method": "cosine_similarity_threshold",
            "clustering_parameters": {"threshold": threshold, "model": EMBEDDING_MODEL_NAME},
        }

    texts = [c["claim_text"] for c in claims]
    st_model = get_st_model()
    embeddings = st_model.encode(texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True)

    num_claims = len(claims)
    assigned = [False] * num_claims
    clusters = []
    unclustered = []

    # Calculate pairwise similarity matrix
    sim_matrix = cosine_similarity(embeddings)

    for i in range(num_claims):
        if assigned[i]:
            continue

        # Find all unassigned claims with similarity >= threshold
        neighbors = [j for j in range(num_claims) if not assigned[j] and sim_matrix[i][j] >= threshold]

        if len(neighbors) >= 2:
            # Create cluster
            cluster_claims_list = [claims[idx] for idx in neighbors]
            for idx in neighbors:
                assigned[idx] = True

            # Representative label from the first claim
            rep_text = claims[i]["claim_text"]
            label = rep_text[:250] + "..." if len(rep_text) > 250 else rep_text

            # Group year breakdown
            year_count = {}
            for c in cluster_claims_list:
                yr = c.get("year", "unknown")
                year_count[str(yr)] = year_count.get(str(yr), 0) + 1

            clusters.append({
                "cluster_label": label,
                "description": f"Cluster of {len(cluster_claims_list)} claims regarding {label}",
                "member_claims_count": len(cluster_claims_list),
                "member_claims": cluster_claims_list,
                "unclustered_flag": "false",
                "year_breakdown": year_count,
            })
        else:
            # Single claim added to unclustered / noise category
            assigned[i] = True
            unclustered.append(claims[i])

    if unclustered:
        clusters.append({
            "cluster_label": "Unclustered / Noise Claims",
            "description": f"Category containing {len(unclustered)} isolated claim statements.",
            "member_claims_count": len(unclustered),
            "member_claims": unclustered,
            "unclustered_flag": "true",
            "year_breakdown": {},
        })

    return {
        "clusters": clusters,
        "unclustered_count": len(unclustered),
        "total_clusters": len(clusters),
        "clustering_method": "cosine_similarity_threshold",
        "clustering_parameters": {"threshold": threshold, "model": EMBEDDING_MODEL_NAME},
    }
