/**
 * Fachada de API para la planilla de cómputos.
 * Centraliza budgetService para que el modal no dependa directamente de sus métodos.
 */
import { budgetService } from '../../../services/budgetService';

export function getAllBudgets() {
  return budgetService.getAll();
}

export function getComputosDrafts() {
  return budgetService.getComputosDrafts();
}

export function saveComputosDraft(payload) {
  return budgetService.saveComputosDraft(payload);
}

export function deleteComputosDraft(draftId) {
  return budgetService.deleteComputosDraft(draftId);
}

export function exportComputosExcel(payload) {
  return budgetService.exportComputosExcel(payload);
}

export function resolveComputo(payload) {
  return budgetService.resolveComputo(payload);
}

export function commitComputoImport(payload) {
  return budgetService.commitImport(payload);
}
