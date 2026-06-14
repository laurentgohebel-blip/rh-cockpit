import {
  STATUS, SEUILS,
  aUnSalaire, salaireETP, moyenne,
  trancheAgeIndex, TRANCHES_AGE_INDEX, SEUIL_INDEX_TOLERANCE,
} from "./constants";

// ─────────────── RÉMUNÉRATION & MASSE SALARIALE ───────────────
export const remunerationCriteria = [
  {
    id: "remu-completude",
    domain: "remuneration",
    label: "Complétude des données de rémunération",
    requiredFields: [],
    evaluate({ seuils = SEUILS, actifs }) {
      const renseignes = actifs.filter(aUnSalaire).length;
      const pct = actifs.length ? (renseignes / actifs.length) * 100 : 0;
      const status = pct >= 90 ? STATUS.conforme : pct >= 70 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: pct,
        valueLabel: `${pct.toFixed(0)}% renseignés (${renseignes}/${actifs.length})`,
        threshold: "≥ 90%",
        evidence: actifs.filter((e) => !aUnSalaire(e)),
      };
    },
  },
  {
    id: "top-remunerations",
    domain: "remuneration",
    label: "Parité dans les plus hautes rémunérations (indicateur n°5 Index Égalité)",
    legalRef: "Décret 2019-15 du 8 janv. 2019 — 10 plus hautes rémunérations (5 si effectif < 250)",
    requiredFields: ["salaire", "sexe"],
    // Barème officiel Index Égalité Pro F/H indicateur 5 :
    //   ≥ 4 femmes / 10 → 10 points (conforme)
    //   2 ou 3 femmes / 10 → 5 points (vigilance)
    //   0 ou 1 femme / 10 → 0 point (non-conforme)
    // Salaire considéré : rémunération brute annuelle équivalent temps plein.
    evaluate({ seuils = SEUILS, actifs, metrics: m }) {
      const N = (m?.totalActifs ?? actifs.length) >= 250 ? 10 : 5;
      const candidats = actifs
        .filter((e) => aUnSalaire(e) && (e.sexe === "Homme" || e.sexe === "Femme"))
        .map((e) => ({ ...e, _etp: salaireETP(e) }))
        .filter((e) => e._etp != null);
      if (candidats.length < N)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: `Moins de ${N} salariés avec salaire renseigné`,
          threshold: `≥ 4 femmes / ${N}`,
          evidence: [],
        };
      const top = candidats.sort((a, b) => b._etp - a._etp).slice(0, N);
      const nbFemmes = top.filter((e) => e.sexe === "Femme").length;

      // Barème adapté à la taille du top (proportionnellement) :
      // N=10 → ≥4 conforme, 2-3 vigilance, 0-1 non-conforme
      // N=5  → ≥2 conforme, 1 vigilance, 0 non-conforme
      const seuilConforme = N === 10 ? 4 : 2;
      const seuilVigilance = N === 10 ? 2 : 1;
      let status;
      if (nbFemmes >= seuilConforme) status = STATUS.conforme;
      else if (nbFemmes >= seuilVigilance) status = STATUS.vigilance;
      else status = STATUS.nonConforme;

      return {
        status,
        value: nbFemmes,
        valueLabel: `${nbFemmes} femme${nbFemmes > 1 ? "s" : ""} dans le top ${N} (en ETP)`,
        threshold: `≥ ${seuilConforme} femmes / ${N}`,
        evidence: top,
      };
    },
  },
  {
    id: "ecart-hf-emploi",
    domain: "remuneration",
    label: "Écart salarial F/H — indicateur n°1 Index Égalité Pro (40 pts officiels)",
    legalRef: "Décret 2019-15 art. 1 — méthode CSP, tolérance 5% par groupe (emploi × tranche d'âge)",
    requiredFields: ["emploi", "salaire", "sexe", "dateNaiss"],
    reliableThreshold: 0.5,
    // Implémentation de l'indicateur n°1 de l'Index Égalité Pro F/H :
    //   - Regroupement par (CSP × tranche d'âge officielle <30/30-39/40-49/50+)
    //   - Notre fichier n'a pas la CSP → on utilise « emploi » comme proxy
    //   - Seuil de tolérance officiel : 5% par groupe (méthode CSP)
    //   - Statut basé sur l'écart pondéré (40 pts si 0%, 0 pt si ≥ 20%)
    evaluate({ seuils = SEUILS, actifs }) {
      const avecEmploi = actifs.filter(
        (e) => e.emploi && aUnSalaire(e) && (e.sexe === "Homme" || e.sexe === "Femme") && e.age != null
      );
      if (avecEmploi.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Colonne « emploi » absente — comparaison Index Égalité impossible",
          threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe (tolérance officielle)`,
          evidence: [],
        };

      // Regroupement par (emploi normalisé × tranche d'âge officielle)
      const groupes = new Map();
      avecEmploi.forEach((e) => {
        const t = trancheAgeIndex(e);
        if (!t) return;
        const key = `${e.emploi.toLowerCase().trim()}||${t.key}`;
        if (!groupes.has(key))
          groupes.set(key, { emploi: e.emploi, tranche: t.label, trancheKey: t.key, h: [], f: [] });
        const g = groupes.get(key);
        const etp = salaireETP(e);
        if (etp == null) return;
        if (e.sexe === "Homme") g.h.push(etp);
        else g.f.push(etp);
      });

      // Méthode officielle : seuls les groupes avec ≥ 3 H ET ≥ 3 F sont comparables
      const comparables = [...groupes.values()].filter((g) => g.h.length >= 3 && g.f.length >= 3);
      if (comparables.length === 0)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Aucun groupe (emploi × tranche d'âge) avec ≥ 3 H et ≥ 3 F",
          threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe`,
          evidence: [],
        };

      // Écart moyen pondéré par effectif total du groupe (méthode officielle)
      let sumWeight = 0, sumWeightedEcart = 0;
      const detail = [];
      comparables.forEach((g) => {
        const mh = moyenne(g.h), mf = moyenne(g.f);
        const ecart = mh ? ((mh - mf) / mh) * 100 : 0;
        // Application du seuil de tolérance par groupe (5%)
        const ecartCorrige = Math.abs(ecart) <= SEUIL_INDEX_TOLERANCE ? 0 : ecart - Math.sign(ecart) * SEUIL_INDEX_TOLERANCE;
        const w = g.h.length + g.f.length;
        sumWeight += w;
        sumWeightedEcart += w * ecartCorrige;
        detail.push({ emploi: g.emploi, tranche: g.tranche, trancheKey: g.trancheKey, ecart, ecartCorrige, w });
      });
      const ecartPondere = sumWeight ? sumWeightedEcart / sumWeight : 0;
      const abs = Math.abs(ecartPondere);

      // Barème officiel — adapté en 3 statuts
      const status = abs <= SEUIL_INDEX_TOLERANCE
        ? STATUS.conforme
        : abs <= 15 ? STATUS.vigilance : STATUS.nonConforme;

      // Points indicatifs sur 40 (barème officiel : 0% = 40 pts, 20%+ = 0 pt, linéaire)
      const pointsIndex = Math.max(0, Math.round(40 * (1 - abs / 20)));

      // Évidence : salariés des groupes où l'écart corrigé est non nul (dépasse le seuil)
      const groupesEcartes = new Set(
        detail.filter((d) => d.ecartCorrige !== 0)
          .map((d) => `${d.emploi.toLowerCase().trim()}||${d.trancheKey}`)
      );
      const evidence = avecEmploi.filter((e) => {
        const t = trancheAgeIndex(e);
        if (!t) return false;
        return groupesEcartes.has(`${e.emploi.toLowerCase().trim()}||${t.key}`);
      });

      return {
        status,
        value: ecartPondere,
        valueLabel: `Écart pondéré ${ecartPondere > 0 ? "+" : ""}${ecartPondere.toFixed(1)}% (après tolérance 5%) · ${comparables.length} groupes comparables · ≈ ${pointsIndex}/40 pts Index`,
        threshold: `≤ ${SEUIL_INDEX_TOLERANCE}% par groupe (tolérance officielle)`,
        evidence,
      };
    },
    risk({ seuils = SEUILS, actifs, metrics: m }) {
      // Pénalité Index Égalité non publié OU score < 75 : jusqu'à 1% de la masse salariale annuelle
      // Ne s'applique qu'aux entreprises ≥ 50 salariés
      if (m.totalActifs < 50) return null;
      const masseAnnuelle = (m.masse || 0) * 12;
      if (masseAnnuelle <= 0) return null;
      return {
        amount: Math.round(masseAnnuelle * 0.01),
        unit: "€",
        label: "Pénalité max. Index Égalité (publication absente ou score < 75/100 sans rattrapage)",
        basis: "Jusqu'à 1% de la masse salariale annuelle (Art. L.2242-8 C. trav.)",
      };
    },
  },
  {
    id: "decile-d9-d1",
    domain: "remuneration",
    label: "Rapport interdécile D9/D1 (équité salariale)",
    legalRef: "Indicateur Bilan social (Art. R.2312-9 C. trav.) — médiane française tous secteurs ≈ 3,0",
    requiredFields: ["salaire"],
    // Calcule le ratio entre le 9e décile (90e centile) et le 1er décile (10e centile)
    // des salaires ETP renseignés. Indicateur d'équité/dispersion salariale.
    evaluate({ seuils = SEUILS, actifs }) {
      const etps = actifs
        .map((e) => salaireETP(e))
        .filter((v) => v != null && v > 0)
        .sort((a, b) => a - b);
      if (etps.length < 10)
        return {
          status: STATUS.nonConcluant,
          value: null,
          valueLabel: "Moins de 10 salaires renseignés — indicateur non significatif",
          threshold: "≤ 3,5 (médiane française)",
          evidence: [],
        };
      // Méthode des centiles : interpolation linéaire
      const percentile = (p) => {
        const idx = (etps.length - 1) * p;
        const lo = Math.floor(idx), hi = Math.ceil(idx);
        return lo === hi ? etps[lo] : etps[lo] + (etps[hi] - etps[lo]) * (idx - lo);
      };
      const d1 = percentile(0.1);
      const d9 = percentile(0.9);
      const ratio = d1 ? d9 / d1 : 0;
      const status = ratio <= 3.5 ? STATUS.conforme
        : ratio <= 5 ? STATUS.vigilance : STATUS.nonConforme;
      return {
        status,
        value: ratio,
        valueLabel: `D9/D1 = ${ratio.toFixed(2)} · D9 ≈ ${Math.round(d9).toLocaleString("fr-FR")}€ · D1 ≈ ${Math.round(d1).toLocaleString("fr-FR")}€ (ETP)`,
        threshold: "≤ 3,5 (médiane FR)",
        evidence: [],
      };
    },
  },
];
