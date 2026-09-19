import json
import os
import sys
import unittest
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.crud.crud_costbase import save_custom_apu
from app.db.base import Base
from app.db.models.costbase import CustomCostItem
from app.services.user_semantic_cache import (
    calculate_vector_similarity,
    compute_description_embedding,
    lookup_user_semantic_cache,
)


class TestUserSemanticCache(unittest.TestCase):
    """
    Suite de pruebas unitarias para el Semantic Cache Privado de APUs por usuario.
    Verifica:
    - Precisión matemática del cálculo de similitud vectorial de coseno.
    - Generación y deserialización de embeddings.
    - Cache HIT ante similitud semántica >= 0.96.
    - Cache MISS ante similitud semántica < 0.96 (fallback a LLM).
    - Aislamiento estricto de privacidad entre usuarios (zero leak).
    - Persistencia automática de embedding al guardar APU personalizada.
    """

    def setUp(self) -> None:
        # Configurar base de datos SQLite en memoria para pruebas aisladas
        self.engine = create_engine("sqlite:///:memory:")
        CustomCostItem.__table__.create(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionLocal()

    def tearDown(self) -> None:
        try:
            self.db.close()
            CustomCostItem.__table__.drop(self.engine)
            self.engine.dispose()
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # 1. Pruebas de Similitud Vectorial (calculate_vector_similarity)
    # -------------------------------------------------------------------------

    def test_calculate_vector_similarity_identical(self) -> None:
        """Vectores idénticos deben tener similitud de coseno igual a 1.0."""
        vec_a = np.array([0.5, 0.5, 0.5, 0.5], dtype=np.float32)
        vec_b = np.array([0.5, 0.5, 0.5, 0.5], dtype=np.float32)
        similarity = calculate_vector_similarity(vec_a, vec_b)
        self.assertAlmostEqual(similarity, 1.0, places=5)

    def test_calculate_vector_similarity_orthogonal(self) -> None:
        """Vectores ortogonales deben tener similitud de coseno igual a 0.0."""
        vec_a = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        vec_b = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        similarity = calculate_vector_similarity(vec_a, vec_b)
        self.assertAlmostEqual(similarity, 0.0, places=5)

    def test_calculate_vector_similarity_opposite(self) -> None:
        """Vectores colineales opuestos deben tener similitud de coseno igual a -1.0."""
        vec_a = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        vec_b = np.array([-1.0, -2.0, -3.0], dtype=np.float32)
        similarity = calculate_vector_similarity(vec_a, vec_b)
        self.assertAlmostEqual(similarity, -1.0, places=5)

    def test_calculate_vector_similarity_zeros_and_empty(self) -> None:
        """Vectores nulos o vacíos deben retornar 0.0 de forma segura sin excepciones."""
        vec_zero = np.array([0.0, 0.0, 0.0], dtype=np.float32)
        vec_valid = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        vec_empty = np.array([], dtype=np.float32)

        self.assertEqual(calculate_vector_similarity(vec_zero, vec_valid), 0.0)
        self.assertEqual(calculate_vector_similarity(vec_empty, vec_valid), 0.0)
        self.assertEqual(calculate_vector_similarity(None, vec_valid), 0.0)  # type: ignore

    # -------------------------------------------------------------------------
    # 2. Pruebas de Generación de Embeddings (compute_description_embedding)
    # -------------------------------------------------------------------------

    def test_compute_description_embedding_invalid_inputs(self) -> None:
        """Entradas vacías, None o de solo espacios deben retornar None inmediatamente."""
        self.assertIsNone(compute_description_embedding(""))
        self.assertIsNone(compute_description_embedding("   "))
        self.assertIsNone(compute_description_embedding(None))  # type: ignore

    @patch("app.services.user_semantic_cache.ai_engine")
    def test_compute_description_embedding_success(self, mock_ai_engine: MagicMock) -> None:
        """Debe delegar en ai_engine.encode_query y retornar ndarray normalizado."""
        mock_ai_engine.is_loaded = True
        dummy_vector = np.array([0.1, 0.2, 0.3], dtype=np.float32)
        mock_ai_engine.encode_query.return_value = dummy_vector

        result = compute_description_embedding("Instalación de bomba de agua 2 HP")
        self.assertIsNotNone(result)
        self.assertTrue(np.array_equal(result, dummy_vector))
        mock_ai_engine.encode_query.assert_called_once_with("Instalación de bomba de agua 2 HP")

    # -------------------------------------------------------------------------
    # 3. Pruebas de Búsqueda en Caché (lookup_user_semantic_cache)
    # -------------------------------------------------------------------------

    def test_lookup_cache_empty_database(self) -> None:
        """Si el usuario no tiene APUs guardadas, debe retornar None inmediatamente."""
        result = lookup_user_semantic_cache(
            db=self.db,
            user_id=42,
            description="Cualquier partida no existente",
            threshold=0.96
        )
        self.assertIsNone(result)

    def test_lookup_cache_user_id_none(self) -> None:
        """Si el usuario no está autenticado (user_id=None), debe retornar None."""
        result = lookup_user_semantic_cache(
            db=self.db,
            user_id=None,
            description="Cualquier partida",
            threshold=0.96
        )
        self.assertIsNone(result)

    @patch("app.services.user_semantic_cache.compute_description_embedding")
    def test_lookup_cache_hit_high_similarity(self, mock_compute: MagicMock) -> None:
        """
        Si existe un APU guardado para el usuario con similitud >= 0.96:
        - Debe retornar el APU estructurado.
        - source debe ser 'user_semantic_cache'.
        - cache_hit debe ser True.
        - similarity debe ser >= 0.96.
        """
        user_id = 10
        saved_vector = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
        # Vector entrante con 99.9% de similitud (ligeramente rotado)
        query_vector = np.array([0.999, 0.02, 0.0, 0.0], dtype=np.float32)
        mock_compute.return_value = query_vector

        sample_apu_data = {
            "partida": {
                "cod_par": "CUST-BOMBA01",
                "description": "BOMBA CENTRÍFUGA DE 2 HP MONOFÁSICA",
                "unit": "PZA",
                "performance": 1.0,
                "quantity": 1.0
            },
            "materials": [
                {
                    "codigo": "MAT-BOMB-2HP",
                    "descripcion": "Bomba centrífuga 2 HP",
                    "unidad": "PZA",
                    "cantidad": 1.0,
                    "precio_unitario": 280.0
                }
            ],
            "equipments": [],
            "labors": [
                {
                    "codigo": "1-1.1",
                    "descripcion": "PLOMERO / ELECTRICISTA",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "jornal": 25.0
                }
            ]
        }

        # Guardar en base de datos de prueba
        item = CustomCostItem(
            id="test-uuid-1",
            user_id=user_id,
            description="Bomba centrífuga de 2 HP monofásica para hidroneumático",
            unit="PZA",
            performance=1.0,
            apu_data=json.dumps(sample_apu_data),
            embedding=json.dumps(saved_vector.tolist())
        )
        self.db.add(item)
        self.db.commit()

        result = lookup_user_semantic_cache(
            db=self.db,
            user_id=user_id,
            description="Suministro de bomba centrífuga 2 HP monofásica",
            threshold=0.96
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["source"], "user_semantic_cache")
        self.assertTrue(result["cache_hit"])
        self.assertGreaterEqual(result["similarity"], 0.96)
        self.assertEqual(result["matched_custom_id"], "test-uuid-1")
        self.assertEqual(len(result["materials"]), 1)
        self.assertEqual(result["materials"][0]["codigo"], "MAT-BOMB-2HP")
        self.assertEqual(len(result["labors"]), 1)
        self.assertIn("recuperado instantáneamente", result["notas_adaptacion"][0])

    @patch("app.services.user_semantic_cache.compute_description_embedding")
    def test_lookup_cache_miss_low_similarity(self, mock_compute: MagicMock) -> None:
        """
        Si la similitud es < 0.96 (por ejemplo 0.70 por tratarse de otra especificación),
        debe retornar None para permitir que el flujo continúe hacia RAG/LLM.
        """
        user_id = 10
        saved_vector = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        # Vector con coseno ~0.707 (ángulo de 45 grados)
        query_vector = np.array([1.0, 1.0, 0.0], dtype=np.float32)
        mock_compute.return_value = query_vector

        item = CustomCostItem(
            id="test-uuid-2",
            user_id=user_id,
            description="Bomba centrífuga de 2 HP monofásica",
            unit="PZA",
            performance=1.0,
            apu_data=json.dumps({"partida": {"description": "Bomba 2 HP"}}),
            embedding=json.dumps(saved_vector.tolist())
        )
        self.db.add(item)
        self.db.commit()

        result = lookup_user_semantic_cache(
            db=self.db,
            user_id=user_id,
            description="Bomba sumergible de 15 HP para pozo profundo",
            threshold=0.96
        )

        self.assertIsNone(result)

    # -------------------------------------------------------------------------
    # 4. Prueba de Privacidad y Aislamiento de Usuarios (Strict Multi-Tenant)
    # -------------------------------------------------------------------------

    @patch("app.services.user_semantic_cache.compute_description_embedding")
    def test_lookup_cache_strict_user_privacy_isolation(self, mock_compute: MagicMock) -> None:
        """
        REGLA DE PRIVACIDAD ESTRICTA:
        Si el Usuario A (id=101) guardó un APU confidencial, el Usuario B (id=202)
        NUNCA debe recibir dicho APU, incluso si realiza una consulta con similitud de 100%.
        """
        user_a_id = 101
        user_b_id = 202

        identical_vector = np.array([1.0, 0.5, 0.25], dtype=np.float32)
        mock_compute.return_value = identical_vector

        # El usuario A guarda su APU
        item_user_a = CustomCostItem(
            id="apu-user-a-secret",
            user_id=user_a_id,
            description="Partida confidencial del Usuario A",
            unit="UND",
            performance=2.0,
            apu_data=json.dumps({"partida": {"description": "Partida confidencial del Usuario A"}}),
            embedding=json.dumps(identical_vector.tolist())
        )
        self.db.add(item_user_a)
        self.db.commit()

        # 1. El usuario B busca exactamente lo mismo -> DEBE DAR NONE (Cache MISS absoluto para B)
        result_b = lookup_user_semantic_cache(
            db=self.db,
            user_id=user_b_id,
            description="Partida confidencial del Usuario A",
            threshold=0.96
        )
        self.assertIsNone(result_b, "Fallo de privacidad: Usuario B tuvo acceso al APU del Usuario A")

        # 2. El usuario A busca su propia partida -> DEBE DAR HIT
        result_a = lookup_user_semantic_cache(
            db=self.db,
            user_id=user_a_id,
            description="Partida confidencial del Usuario A",
            threshold=0.96
        )
        self.assertIsNotNone(result_a)
        self.assertEqual(result_a["matched_custom_id"], "apu-user-a-secret")

    # -------------------------------------------------------------------------
    # 5. Integración con save_custom_apu
    # -------------------------------------------------------------------------

    @patch("app.crud.crud_costbase.compute_description_embedding")
    def test_save_custom_apu_persists_embedding(self, mock_compute: MagicMock) -> None:
        """
        Verifica que al invocar save_custom_apu:
        - Se invoque compute_description_embedding.
        - El vector se almacene serializado en formato JSON en el campo embedding.
        """
        mock_vector = np.array([0.123, 0.456, 0.789], dtype=np.float32)
        mock_compute.return_value = mock_vector

        saved_item = save_custom_apu(
            db=self.db,
            description="Tablero de control para 2 bombas alternadas",
            unit="PZA",
            performance=1.0,
            apu_data=json.dumps({"partida": {"description": "Tablero"}}),
            user_id=555
        )

        self.assertIsNotNone(saved_item)
        self.assertIsNotNone(saved_item.embedding)

        # Deserializar y comprobar valores numéricos
        deserialized = json.loads(saved_item.embedding)
        self.assertEqual(len(deserialized), 3)
        self.assertAlmostEqual(deserialized[0], 0.123, places=3)
        self.assertAlmostEqual(deserialized[1], 0.456, places=3)
        self.assertAlmostEqual(deserialized[2], 0.789, places=3)


if __name__ == "__main__":
    unittest.main()
