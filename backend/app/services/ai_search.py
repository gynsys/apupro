import os
import re
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any

class AISearchEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AISearchEngine, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.embeddings = None
            cls._instance.ids_mapping = []
            cls._instance.is_loaded = False
        return cls._instance

    def load_brain(self):
        if self.is_loaded:
            return

        print("Iniciando carga del 'Cerebro' de IA...")
        
        # 1. Cargar el modelo transformer
        try:
            # paraphrase-multilingual-MiniLM-L12-v2
            self.model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
            print("Modelo SentenceTransformer cargado exitosamente.")
        except Exception as e:
            print(f"Error cargando el modelo de IA: {e}")

        # 2. Cargar matriz NumPy
        npy_path = os.path.join(os.path.dirname(__file__), '..', '..', 'embeddings_partidas.npy')
        
        # Path fallback para entorno local (escritorio) si no existe en producción
        fallback_path = r'C:\Users\pablo\Desktop\BD_COST360\embeddings_partidas.npy'

        if os.path.exists(npy_path):
            self.embeddings = np.load(npy_path)
            print(f"Matriz de embeddings cargada desde {npy_path} con forma {self.embeddings.shape}")
        elif os.path.exists(fallback_path):
            self.embeddings = np.load(fallback_path)
            print(f"Matriz de embeddings cargada desde fallback {fallback_path} con forma {self.embeddings.shape}")
        else:
            print(f"ADVERTENCIA: No se encontró el archivo de embeddings en {npy_path} ni en {fallback_path}.")
            
        # 3. Cargar mapeo de IDs desde el CSV
        csv_path = r'C:\Users\pablo\Desktop\BD_COST360\Base_Datos_IA.csv'
        if os.path.exists(csv_path):
            import pandas as pd
            df = pd.read_csv(csv_path, usecols=['Referencia'])
            self.ids_mapping = df['Referencia'].astype(str).tolist()
            print(f"Cargados {len(self.ids_mapping)} IDs de mapeo.")
        else:
            print(f"ADVERTENCIA: No se encontró {csv_path} para el mapeo de IDs.")

        if self.model is not None and self.embeddings is not None and self.ids_mapping:
            self.is_loaded = True

    def calculate_cosine_similarity(self, query_embedding: np.ndarray) -> np.ndarray:
        if not self.is_loaded or self.embeddings is None:
            return np.array([])
        
        # similitud del coseno: (A . B) / (||A|| * ||B||)
        # Asumiendo que self.embeddings ya están normalizados (típico en sentence-transformers)
        # Si no lo están:
        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
        
        dot_product = np.dot(self.embeddings, query_embedding.T).flatten()
        similarities = dot_product / (norm_embeddings * norm_query + 1e-10)
        return similarities

    def calculate_similarity_for_subset(self, query: str, valid_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Calcula la similitud semántica solo para un subconjunto de IDs.
        Retorna una lista ordenada de diccionarios con {'id': ..., 'score': ...}.
        """
        if not self.is_loaded or self.embeddings is None or self.model is None:
            return []

        # Vectorizar query
        query_embedding = self.model.encode([query])

        # Obtener índices del subconjunto (usamos un set para búsqueda rápida)
        valid_ids_set = set(valid_ids)
        valid_indices = []
        valid_id_map = []
        for i, id_val in enumerate(self.ids_mapping):
            if id_val in valid_ids_set:
                valid_indices.append(i)
                valid_id_map.append(id_val)

        if not valid_indices:
            return []

        # Extraer embeddings del subconjunto
        subset_embeddings = self.embeddings[valid_indices]

        # Calcular similitud coseno
        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(subset_embeddings, axis=1)
        
        dot_product = np.dot(subset_embeddings, query_embedding.T).flatten()
        similarities = dot_product / (norm_embeddings * norm_query + 1e-10)

        # Armar y ordenar resultados
        results = [
            {"id": valid_id_map[i], "score": float(similarities[i])}
            for i in range(len(valid_indices))
        ]
        results.sort(key=lambda x: x["score"], reverse=True)
        return results

ai_engine = AISearchEngine()
