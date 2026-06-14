# Evaluation Report — Offline Model Classification

**Date**: 2026-06-14
**Classifier**: Local Multi-Layer Perceptron (MLP) (`lr_model.json`)
**Dataset**: `merged_tickets.csv`
**Evaluation Sample**: 120 tickets (stratified from 26681 total)
*Note: Evaluated against the 6 custom mapped classes from training.*

---

## Summary Metrics

| Metric | Score |
|---|---|
| **Overall Accuracy** | 65.0% |
| **Macro F1 Score** | 65.0% |
| **Weighted F1 Score** | 65.0% |

## Per-Category Classification Report

| Category | Precision | Recall | F1 Score | Support |
|---|---|---|---|---|
| Application | 44.0% | 55.0% | 48.9% | 20 |
| Infrastructure | 53.8% | 70.0% | 60.9% | 20 |
| Security | 100.0% | 45.0% | 62.1% | 20 |
| Database | 75.0% | 90.0% | 81.8% | 20 |
| Network | 78.6% | 55.0% | 64.7% | 20 |
| Access Management | 68.2% | 75.0% | 71.4% | 20 |
