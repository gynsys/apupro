"""
Análisis algorítmico de materiales de construcción.
Objetivos:
  1. Determinar cuántas familias naturales existen en la BD
  2. Identificar los materiales "líderes" de cada familia
  3. Calcular cobertura de actualización por familia

Dependencias: pandas, sklearn, numpy (ya en requirements.txt)
"""
import json
import re
from collections import Counter
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial

# ──────────────────────────────────────────────────────────────────────────────
# 1. EXTRAER DATOS
# ──────────────────────────────────────────────────────────────────────────────
print("Conectando a BD...")
db = SessionLocal()
materials = db.query(CostMaterial).filter(
    CostMaterial.Descri.isnot(None),
    CostMaterial.Descri != ""
).all()
db.close()

descriptions = [m.Descri.strip().upper() for m in materials if m.Descri and len(m.Descri.strip()) > 3]
codes = [m.CodMat for m in materials if m.Descri and len(m.Descri.strip()) > 3]
units = [m.UniMat for m in materials if m.Descri and len(m.Descri.strip()) > 3]

print(f"Total materiales: {len(descriptions)}")

# ──────────────────────────────────────────────────────────────────────────────
# 2. ANÁLISIS DE PALABRAS CLAVE (frecuencia)
# ──────────────────────────────────────────────────────────────────────────────
# Stopwords español + construcción genérica
STOPWORDS = {
    'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'E', 'O', 'U', 'A', 'EN',
    'CON', 'POR', 'PARA', 'SIN', 'SOBRE', 'UN', 'UNA', 'X', 'P', 'MM', 'CM',
    'ML', 'KG', 'KGS', 'M2', 'M3', 'UND', 'GL', 'LT', 'GA', 'PLG', 'MT',
    'QQ', 'KL', 'TON', 'GR', 'MG', 'LB', 'OZ', '1/4', '1/2', '3/4', '3/8',
    '5/8', '1/8', '5/16', 'NO', 'NRO', 'N°', 'TIPO', 'GRADO', 'CLASE',
    'DIAMETRO', 'DIAM', 'ESP', 'E=', 'E', 'N', 'S', 'C', 'T',
}

def tokenize(text):
    tokens = re.split(r'[\s\-\/\.\,\(\)\#\*\+]+', text)
    return [t for t in tokens if len(t) >= 3 and t not in STOPWORDS and not t.isdigit()]

all_tokens = []
for desc in descriptions:
    all_tokens.extend(tokenize(desc))

token_freq = Counter(all_tokens)
print(f"\nTop 50 palabras clave en la BD:")
for word, count in token_freq.most_common(50):
    pct = count / len(descriptions) * 100
    print(f"  {word:<25} {count:>5} materiales ({pct:.1f}%)")

# ──────────────────────────────────────────────────────────────────────────────
# 3. CLUSTERING CON TF-IDF + K-MEANS
# ──────────────────────────────────────────────────────────────────────────────
print("\n\nAplicando TF-IDF + K-Means clustering...")
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans, MiniBatchKMeans
from sklearn.metrics import silhouette_score
import numpy as np

vectorizer = TfidfVectorizer(
    max_features=500,
    min_df=2,
    max_df=0.85,
    token_pattern=r'[A-ZÁÉÍÓÚÑ]{3,}',
    lowercase=False
)
X = vectorizer.fit_transform(descriptions)
print(f"Matriz TF-IDF: {X.shape[0]} materiales × {X.shape[1]} términos")

# Curva del codo: probar K de 5 a 50
inertias = []
silhouettes = []
K_range = list(range(5, 55, 5))

print("\nCalculando curva del codo (K óptimo)...")
for k in K_range:
    km = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3, batch_size=1000)
    labels = km.fit_predict(X)
    inertias.append(km.inertia_)
    if k <= 40:
        sil = silhouette_score(X, labels, sample_size=min(2000, len(descriptions)))
        silhouettes.append(sil)
        print(f"  K={k:>2}: inercia={km.inertia_:.0f}, silhouette={sil:.4f}")
    else:
        silhouettes.append(None)
        print(f"  K={k:>2}: inercia={km.inertia_:.0f}")

# Encontrar K óptimo por silhouette
valid_sil = [(K_range[i], s) for i, s in enumerate(silhouettes) if s is not None]
best_k, best_sil = max(valid_sil, key=lambda x: x[1])
print(f"\n→ K ÓPTIMO POR SILHOUETTE: K={best_k} (score={best_sil:.4f})")

# ──────────────────────────────────────────────────────────────────────────────
# 4. CLUSTERIZAR CON K ÓPTIMO Y ANALIZAR LÍDERES
# ──────────────────────────────────────────────────────────────────────────────
print(f"\nClusterizando con K={best_k}...")
km_final = KMeans(n_clusters=best_k, random_state=42, n_init=10, max_iter=300)
labels_final = km_final.fit_predict(X)

# Analizar cada cluster
feature_names = vectorizer.get_feature_names_out()
results = []

for cluster_id in range(best_k):
    mask = labels_final == cluster_id
    cluster_descs = [descriptions[i] for i in range(len(descriptions)) if mask[i]]
    cluster_codes = [codes[i] for i in range(len(descriptions)) if mask[i]]
    cluster_units = [units[i] for i in range(len(descriptions)) if mask[i]]
    
    # Palabras más representativas del cluster
    center = km_final.cluster_centers_[cluster_id]
    top_idx = center.argsort()[-5:][::-1]
    top_words = [feature_names[i] for i in top_idx]
    
    # Material más cercano al centroide (el "líder natural")
    cluster_X = X[mask].toarray()  # Convertir a matriz densa
    dists = ((cluster_X - center) ** 2).sum(axis=1)
    if hasattr(dists, 'A1'):
        dists = dists.A1
    leader_local_idx = np.argmin(dists)
    leader_desc = cluster_descs[leader_local_idx]
    leader_code = cluster_codes[leader_local_idx]
    
    # Unidad más común
    unit_counter = Counter([u for u in cluster_units if u])
    most_common_unit = unit_counter.most_common(1)[0][0] if unit_counter else 'N/A'
    
    results.append({
        "cluster_id": cluster_id,
        "size": len(cluster_descs),
        "pct_of_total": round(len(cluster_descs) / len(descriptions) * 100, 2),
        "top_words": top_words,
        "leader_code": leader_code,
        "leader_desc": leader_desc,
        "most_common_unit": most_common_unit,
        "sample": cluster_descs[:3]
    })

# Ordenar por tamaño (mayor primero)
results.sort(key=lambda x: x['size'], reverse=True)

print(f"\n{'='*80}")
print(f"RESULTADO: {best_k} FAMILIAS NATURALES DETECTADAS")
print(f"{'='*80}")
for r in results:
    print(f"\nFamilia #{r['cluster_id']+1:>2} | {r['size']:>4} materiales ({r['pct_of_total']:>5.1f}%) | Palabras clave: {', '.join(r['top_words'])}")
    print(f"   Líder:    [{r['leader_code']}] {r['leader_desc']}")
    print(f"   Unidad:   {r['most_common_unit']}")
    if r['sample']:
        print(f"   Muestras: {r['sample'][0][:60]}")

print(f"\n{'='*80}")
print(f"RESUMEN EJECUTIVO:")
print(f"  Total materiales analizados:  {len(descriptions)}")
print(f"  Número óptimo de familias:    {best_k}")
print(f"  Familias grandes (>50 mat.):  {sum(1 for r in results if r['size'] > 50)}")
print(f"  Familias medianas (10-50):    {sum(1 for r in results if 10 <= r['size'] <= 50)}")
print(f"  Familias pequeñas (<10 mat.): {sum(1 for r in results if r['size'] < 10)}")
print(f"  Materiales en top-10 familias:{sum(r['size'] for r in results[:10])} ({sum(r['pct_of_total'] for r in results[:10]):.1f}%)")

# Guardar resultados
with open('/app/analysis_results.json', 'w', encoding='utf-8') as f:
    json.dump({
        "total_materials": len(descriptions),
        "optimal_k": best_k,
        "best_silhouette": best_sil,
        "k_range": K_range,
        "inertias": inertias,
        "families": results
    }, f, ensure_ascii=False, indent=2)

print(f"\nResultados guardados en /app/analysis_results.json")
print("ANÁLISIS COMPLETADO")
