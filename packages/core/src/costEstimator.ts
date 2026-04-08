// CostEstimator
// Çok kaba bir token/maliyet tahminleyici.
// Bu MVP'de sadece karakter sayısından yaklaşık token sayısı üretir.

import { createCostEntry } from "@db/index";
import type { Run } from "@shared/index";

// Basit yaklaşık oran: 1 token ~ 4 karakter
const CHARS_PER_TOKEN = 4;

// Varsayılan fiyatlama: 1K token ~ 0.01 USD (tamamen örnek)
const USD_PER_1K_TOKENS = 0.01;

export class CostEstimator {
  static estimateTokens(text: string): number {
    const chars = text.length;
    return Math.max(1, Math.round(chars / CHARS_PER_TOKEN));
  }

  static estimateCostUsd(tokens: number): number {
    const thousands = tokens / 1000;
    return Number((thousands * USD_PER_1K_TOKENS).toFixed(6));
  }

  // DB'ye maliyet kaydı açar
  static recordCost(run: Run, combinedText: string) {
    const tokens = this.estimateTokens(combinedText);
    const cost = this.estimateCostUsd(tokens);
    createCostEntry({
      runId: run.id,
      estimatedTokens: tokens,
      estimatedCostUsd: cost
    });
  }
}

