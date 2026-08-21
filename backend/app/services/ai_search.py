import os
import re
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text

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
        # Orden de búsqueda: producción Docker (/app/) -> relativa -> local Windows
        npy_docker_path = '/app/embeddings_partidas.npy'
        npy_relative_path = os.path.join(os.path.dirname(__file__), '..', '..', 'embeddings_partidas.npy')
        npy_local_path = r'C:\Users\pablo\Desktop\BD_COST360\embeddings_partidas.npy'
        
        npy_path = None
        for candidate in [npy_docker_path, npy_relative_path, npy_local_path]:
            if os.path.exists(candidate):
                npy_path = candidate
                break

        if npy_path:
            self.embeddings = np.load(npy_path)
            print(f"Matriz de embeddings cargada desde {npy_path} con forma {self.embeddings.shape}")
        else:
            print(f"ERROR CRITICO: No se encontró embeddings_partidas.npy en ninguna ruta buscada.")
            
        # 3. Cargar mapeo de IDs desde el CSV
        # Orden de búsqueda: producción Docker (/app/) -> relativa -> local Windows
        csv_docker_path = '/app/Base_Datos_IA.csv'
        csv_relative_path = os.path.join(os.path.dirname(__file__), '..', '..', 'Base_Datos_IA.csv')
        csv_local_path = r'C:\Users\pablo\Desktop\BD_COST360\Base_Datos_IA.csv'
        
        csv_path_to_use = None
        for candidate in [csv_docker_path, csv_relative_path, csv_local_path]:
            if os.path.exists(candidate):
                csv_path_to_use = candidate
                break
            
        if csv_path_to_use:
            import pandas as pd
            df = pd.read_csv(csv_path_to_use, usecols=['Referencia'])
            self.ids_mapping = df['Referencia'].astype(str).tolist()
            print(f"Cargados {len(self.ids_mapping)} IDs de mapeo desde {csv_path_to_use}.")
        else:
            print(f"ERROR CRITICO: No se encontró Base_Datos_IA.csv en ninguna ruta:")
            print(f"  - Relativa: {os.path.abspath(csv_relative_path)}")
            print(f"  - Local: {csv_local_path}")

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

    def extract_main_chunk(self, query: str) -> str:
        """
        Divide la consulta y extrae solo la parte principal ignorando modificadores
        como 'sin incluir', 'no incluye', 'utilizando', 'con'.
        Esto evita que la IA se distraiga con palabras secundarias.
        """
        # Expresión regular para separar la frase en base a palabras clave de exclusión/condición
        splitters = re.compile(r'\b(sin incluir|no incluye|utilizando|con empleo de|empleando)\b', re.IGNORECASE)
        parts = splitters.split(query)
        if parts:
            # La primera parte suele ser la intención principal de búsqueda
            main_chunk = parts[0].strip()
            return main_chunk if len(main_chunk) > 5 else query
        return query

    def lexical_search(self, db: Session, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Búsqueda Tradicional (Full-Text Search) usando PostgreSQL.
        Busca coincidencias exactas de las palabras en el campo Descri.
        """
        # Convertir query a formato "palabra | palabra | palabra" para tsquery flexibilizado
        words = [w for w in query.split() if len(w) > 2]
        if not words:
            return []
        
        tsquery_str = " | ".join(words)
        
        sql = text('''
            SELECT "CodPar", "CovPar", "Descri",
                   ts_rank(to_tsvector('spanish', "Descri"), to_tsquery('spanish', :tsquery)) as rank
            FROM public.cost360_items
            WHERE "CovPar" NOT LIKE '% S/C%'
              AND to_tsvector('spanish', "Descri") @@ to_tsquery('spanish', :tsquery)
            ORDER BY rank DESC
            LIMIT :limit
        ''')
        
        results = db.execute(sql, {"tsquery": tsquery_str, "limit": limit}).fetchall()
        
        return [
            {"id": row.CodPar, "score": float(row.rank), "desc": row.Descri}
            for row in results
        ]

    def hybrid_search(self, db: Session, query: str, valid_ids: List[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
        """
        Búsqueda Híbrida que combina el score Semántico (SentenceTransformers)
        con el score Léxico (PostgreSQL ts_rank).
        Si valid_ids se proporciona, solo busca en esos IDs.
        """
        if not self.is_loaded or self.embeddings is None or self.model is None:
            return []

        # 1. Puntaje Semántico (RAG)
        # Usamos chunking para no distraer al modelo con "sin incluir"
        main_query = self.extract_main_chunk(query)
        query_embedding = self.model.encode([main_query])
        
        norm_query = np.linalg.norm(query_embedding)
        norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
        dot_product = np.dot(self.embeddings, query_embedding.T).flatten()
        sem_similarities = dot_product / (norm_embeddings * norm_query + 1e-10)

        # Si hay limitación de IDs (Ej. filtrado por categoría), filtramos los semánticos
        valid_indices = []
        if valid_ids is not None:
            valid_ids_set = set(valid_ids)
            for i, id_val in enumerate(self.ids_mapping):
                if id_val in valid_ids_set:
                    valid_indices.append(i)
        else:
            valid_indices = list(range(len(self.ids_mapping)))

        semantic_scores = {
            self.ids_mapping[i]: float(sem_similarities[i])
            for i in valid_indices
        }

        # 2. Puntaje Léxico (Traditional)
        lexical_results = self.lexical_search(db, main_query, limit=1000)
        lexical_scores = {r['id']: r['score'] for r in lexical_results}

        # Normalizar scores léxicos (max rank puede ser > 1.0, lo normalizamos a 0-1)
        max_lex_score = max(lexical_scores.values()) if lexical_scores else 1.0
        if max_lex_score == 0: max_lex_score = 1.0

        # 3. Fusión Híbrida
        # Fórmula: 70% Semántico + 30% Léxico (si existe)
        # Si la palabra exacta no existe, el score léxico es 0, penalizando ligeramente pero no eliminando.
        hybrid_results = []
        for item_id, sem_score in semantic_scores.items():
            lex_score = lexical_scores.get(item_id, 0.0) / max_lex_score
            
            # Penalización fuerte si la frase tiene coincidencia semántica pero 0 palabras clave
            # y el puntaje semántico no es abrumadoramente alto.
            if lex_score == 0.0 and sem_score < 0.60:
                final_score = sem_score * 0.70
            else:
                final_score = (sem_score * 0.70) + (lex_score * 0.30)
                
            hybrid_results.append({
                "id": item_id,
                "score": final_score,
                "sem_score": sem_score,
                "lex_score": lex_score
            })

        # Ordenar por el score híbrido
        hybrid_results.sort(key=lambda x: x["score"], reverse=True)
        return hybrid_results[:limit]

ai_engine = AISearchEngine()
