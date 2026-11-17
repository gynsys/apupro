import { round2 } from './formulas.js';

function normText(val) {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normCode(val) {
  const clean = normText(val).replace(/[.\-\s]/g, '');
  if (!clean || clean === 'S/C' || clean === 'SC') return '';
  return clean;
}

function itemMatchKey(item) {
  const chapter = normText(item.chapter || '');
  const code = normCode(item.covPar || item.linkedCode || item.code);
  const desc = normText(item.description);
  const unit = normText(item.unit || 'UND');
  if (code) return `${chapter}::CODE::${code}`;
  return `${chapter}::DESC::${desc}::${unit}`;
}

function toPartialsList(item) {
  if (Array.isArray(item.partials) && item.partials.length > 0) {
    return item.partials.map((p) => ({ ...p }));
  }
  const qty = Number(item.quantity ?? item.partial ?? 0) || 0;
  const hasDims =
    (item.length !== '' && item.length != null) ||
    (item.width !== '' && item.width != null) ||
    (item.height !== '' && item.height != null) ||
    (item.factor !== '' && item.factor != null) ||
    (item.distance !== '' && item.distance != null) ||
    (item.m3 !== '' && item.m3 != null);
  if (qty > 0 || hasDims) {
    return [
      {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: item.observations || 'Medición',
        length: item.length ?? '',
        width: item.width ?? '',
        height: item.height ?? '',
        times: item.times ?? 1,
        factor: item.factor ?? '',
        distance: item.distance ?? '',
        m3: item.m3 ?? '',
        partial: round2(qty),
        formula: item.formula ?? '',
        observations: item.observations ?? '',
      },
    ];
  }
  return [];
}

function partialSignature(p) {
  return [
    normText(p.description || p.observations),
    String(p.length ?? ''),
    String(p.width ?? ''),
    String(p.height ?? ''),
    String(p.times ?? 1),
    String(p.factor ?? ''),
    String(p.distance ?? ''),
    String(p.m3 ?? ''),
    String(round2(Number(p.partial || 0))),
  ].join('|');
}

function cloneItemWithNewId(item) {
  return {
    ...item,
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partials: Array.isArray(item.partials) ? item.partials.map((p) => ({ ...p })) : item.partials ?? null,
  };
}

/**
 * Unifica dos planillas de cómputos trabajadas en paralelo.
 * @param {Object} baseDraft - Planilla principal
 * @param {Object} incomingDraft - Planilla secundaria a incorporar
 * @param {Object} options - { conflictStrategy: 'combine' | 'keep_base' | 'use_incoming', targetName?: string }
 */
export function mergeComputosDrafts(baseDraft, incomingDraft, options = {}) {
  const strategy = options.conflictStrategy || 'combine';
  const baseItems = Array.isArray(baseDraft?.items) ? baseDraft.items.map(cloneItemWithNewId) : [];
  const incomingItems = Array.isArray(incomingDraft?.items) ? incomingDraft.items : [];

  const resultItems = [...baseItems];
  const baseChapters = new Set(baseItems.map((it) => normText(it.chapter || '')).filter(Boolean));
  const indexByKey = new Map();
  resultItems.forEach((it, idx) => {
    const k = itemMatchKey(it);
    if (!indexByKey.has(k)) indexByKey.set(k, idx);
  });

  const stats = {
    chaptersAdded: 0,
    itemsAdded: 0,
    itemsMerged: 0,
    partialsAdded: 0,
  };
  const addedChapters = new Set();

  for (const rawInc of incomingItems) {
    if (!rawInc || (!(rawInc.description || '').trim() && !Number(rawInc.quantity))) continue;
    const key = itemMatchKey(rawInc);
    const chapNorm = normText(rawInc.chapter || '');

    if (!indexByKey.has(key)) {
      const cloned = cloneItemWithNewId(rawInc);
      if (chapNorm && !baseChapters.has(chapNorm) && !addedChapters.has(chapNorm)) {
        addedChapters.add(chapNorm);
        stats.chaptersAdded += 1;
      }
      // Insertar al final de su capítulo si ya existe en base, o al final de la planilla
      let insertIdx = resultItems.length;
      if (chapNorm) {
        for (let i = resultItems.length - 1; i >= 0; i--) {
          if (normText(resultItems[i].chapter || '') === chapNorm) {
            insertIdx = i + 1;
            break;
          }
        }
      }
      resultItems.splice(insertIdx, 0, cloned);
      // Reindexar claves desplazadas
      indexByKey.clear();
      resultItems.forEach((it, idx) => {
        const k = itemMatchKey(it);
        if (!indexByKey.has(k)) indexByKey.set(k, idx);
      });
      stats.itemsAdded += 1;
      continue;
    }

    if (strategy === 'keep_base') {
      continue;
    }

    const targetIdx = indexByKey.get(key);
    const existing = resultItems[targetIdx];

    if (strategy === 'use_incoming') {
      resultItems[targetIdx] = {
        ...cloneItemWithNewId(rawInc),
        id: existing.id,
      };
      stats.itemsMerged += 1;
      continue;
    }

    // strategy === 'combine': combinar parciales no duplicados y recalcular total
    const basePartials = toPartialsList(existing);
    const incPartials = toPartialsList(rawInc);
    const seenSigs = new Set(basePartials.map(partialSignature));
    let addedHere = 0;

    for (const p of incPartials) {
      const sig = partialSignature(p);
      if (!seenSigs.has(sig)) {
        seenSigs.add(sig);
        basePartials.push({
          ...p,
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
        addedHere += 1;
      }
    }

    if (addedHere > 0) {
      const newTotal = round2(basePartials.reduce((acc, p) => acc + (Number(p.partial || 0) || 0), 0));
      resultItems[targetIdx] = {
        ...existing,
        partials: basePartials,
        partial: newTotal,
        quantity: newTotal,
      };
      stats.itemsMerged += 1;
      stats.partialsAdded += addedHere;
    }
  }

  const baseName = (baseDraft?.budgetName || 'Planilla').trim();
  const targetName = (options.targetName || `${baseName} (Unificada)`).trim();

  return {
    draft: {
      id: `draft-${Date.now()}`,
      budgetId: baseDraft?.budgetId || null,
      savedAt: new Date().toISOString(),
      budgetName: targetName,
      projectName: baseDraft?.projectName || incomingDraft?.projectName || '',
      clientName: baseDraft?.clientName || incomingDraft?.clientName || '',
      currency: baseDraft?.currency || incomingDraft?.currency || 'USD',
      activeChapter: baseDraft?.activeChapter || incomingDraft?.activeChapter || '',
      items: resultItems,
      itemCount: resultItems.length,
    },
    stats,
  };
}
