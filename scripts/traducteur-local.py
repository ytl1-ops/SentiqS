#!/usr/bin/env python3
# Traducteur hors ligne du job de traduction (22/11/2026).
#
# Pourquoi : depuis les runners GitHub, Google « gtx » et MyMemory ne
# répondent plus (passage du 22/11/2026 à 8 h UTC : 0 traduction nouvelle,
# 729 échecs, 1 967 reportées) et Gemini attend une clé qui n'est pas visible
# par Actions. Argos Translate (licence MIT, modèles OPUS-MT sous licence
# libre) traduit sur le runner lui-même : aucune clé, aucun quota, aucune
# adresse partagée qui sature.
#
# Protocole : une requête JSON par ligne sur l'entrée standard,
#   {"id": 1, "source": "pt", "cible": "fr", "lignes": ["…", "…"]}
# une réponse par ligne sur la sortie standard,
#   {"id": 1, "lignes": ["…", null, "…"]}  (null : ligne non traduite)
# La première ligne écrite est {"pret": true, "paires": [...]} une fois les
# modèles chargés. Rien d'autre n'est écrit sur la sortie standard.
#
# Paires installées : en→fr, fr→en, pt→en, ar→en, es→en. Une source autre que
# l'anglais vers le français passe par l'anglais (pt→en→fr) ; une langue
# inconnue (« auto ») est refusée : on ne devine pas une langue.
import json
import os
import sys

os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")

PAIRES = [("en", "fr"), ("fr", "en"), ("pt", "en"), ("ar", "en"), ("es", "en")]


def journal(*args):
    print(*args, file=sys.stderr, flush=True)


def installer():
    import argostranslate.package as pk

    installes = {(p.from_code, p.to_code) for p in pk.get_installed_packages()}
    manquants = [p for p in PAIRES if p not in installes]
    if manquants:
        pk.update_package_index()
        dispo = pk.get_available_packages()
        for a, b in manquants:
            cand = [p for p in dispo if p.from_code == a and p.to_code == b]
            if not cand:
                journal("Modèle introuvable :", a, "→", b)
                continue
            journal("Téléchargement du modèle", a, "→", b)
            pk.install_from_path(cand[0].download())
    return {(p.from_code, p.to_code) for p in pk.get_installed_packages()}


def main():
    import argostranslate.translate as tr

    paires = installer()
    cache = {}

    def traducteur(a, b):
        if (a, b) not in cache:
            try:
                cache[(a, b)] = tr.get_translation_from_codes(a, b)
            except Exception:
                cache[(a, b)] = None
        return cache[(a, b)]

    def un(texte, source, cible):
        if source == cible:
            return texte
        if (source, cible) in paires:
            t = traducteur(source, cible)
            return t.translate(texte) if t else None
        # Pivot par l'anglais : pt → en → fr.
        if (source, "en") in paires and ("en", cible) in paires:
            a, b = traducteur(source, "en"), traducteur("en", cible)
            if a and b:
                return b.translate(a.translate(texte))
        return None

    print(json.dumps({"pret": True, "paires": sorted("%s>%s" % p for p in paires)}), flush=True)
    for brut in sys.stdin:
        brut = brut.strip()
        if not brut:
            continue
        try:
            req = json.loads(brut)
        except Exception:
            continue
        rid = req.get("id")
        source = str(req.get("source") or "")
        cible = str(req.get("cible") or "")
        lignes = req.get("lignes") or []
        sortie = None
        if source and source != "auto" and cible and isinstance(lignes, list):
            # Ligne par ligne : un titre qui fait tomber le modèle ne coûte que
            # lui (null à sa place), pas tout le paquet.
            sortie = []
            for l in lignes:
                try:
                    x = un(str(l), source, cible)
                except Exception as e:
                    journal("Échec de traduction locale :", type(e).__name__)
                    x = None
                sortie.append(x.strip() if isinstance(x, str) and x.strip() else None)
        print(json.dumps({"id": rid, "lignes": sortie}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
