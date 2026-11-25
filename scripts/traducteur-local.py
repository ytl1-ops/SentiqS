#!/usr/bin/env python3
# Traducteur hors ligne des jobs de traduction et de collecte.
#
# 22/11/2026 — pourquoi un traducteur sur le runner : depuis GitHub Actions,
# Google « gtx » et MyMemory ne répondent plus (passage du 22/11/2026 à 8 h
# UTC : 0 traduction nouvelle sur 766 requêtes) et aucune clé n'est posée.
# Les modèles OPUS-MT empaquetés par Argos Translate (licences libres)
# traduisent sur le runner : aucune clé, aucun quota, aucune adresse partagée
# qui sature.
#
# 25/11/2026 — pourquoi ce script n'utilise plus la bibliothèque Argos. Mesure
# du passage du 25/11 à 17 h 19 UTC : 649 lignes traduites en 480 s
# (~1,4 ligne/s), 1 259 reportées, 2 380 échecs. Trois causes, toutes dans la
# façon d'appeler le modèle, pas dans le modèle :
#   · Argos traduit UN texte par appel au modèle (translate_batch sur les
#     phrases d'un seul titre, lots de 32 *jetons*) : le processeur attend ;
#   · il découpe chaque texte en phrases avec Stanza (réseau de neurones sur
#     CPU), y compris un titre d'une seule phrase ;
#   · un paquet de 25 chapôs dépassait le délai de 60 s du pont Node : tout le
#     paquet comptait en échec, et le processus, toujours occupé, faisait
#     échouer les suivants en cascade.
# Ici, CTranslate2 et SentencePiece sont appelés directement, sur TOUTES les
# phrases d'un paquet en une fois (lots de 32 phrases), avec un découpage en
# phrases par expression régulière (titres et chapôs de presse : ponctuation
# simple). Mêmes modèles, mêmes fichiers, même sortie à la ponctuation près.
# Dépendances : ctranslate2 et sentencepiece seulement (plus de torch, Stanza
# ni spaCy : ~40 Mo au lieu de ~900 Mo, installation en quelques secondes).
#
# Protocole : une requête JSON par ligne sur l'entrée standard,
#   {"id": 1, "source": "pt", "cible": "fr", "lignes": ["…", "…"]}
# une réponse par ligne sur la sortie standard,
#   {"id": 1, "lignes": ["…", null, "…"]}  (null : ligne non traduite)
# La première ligne écrite est {"pret": true, "paires": [...]} une fois les
# modèles trouvés. Rien d'autre n'est écrit sur la sortie standard.
#
# Paires : en→fr, fr→en, pt→en, ar→en, es→en. Une source autre que l'anglais
# vers le français passe par l'anglais (pt→en→fr) ; une langue inconnue
# (« auto ») est refusée : on ne devine pas une langue.
import json
import os
import re
import sys
import zipfile
import urllib.request

PAIRES = [("en", "fr"), ("fr", "en"), ("pt", "en"), ("ar", "en"), ("es", "en")]
INDEX = os.environ.get(
    "ARGOS_PACKAGE_INDEX_URL",
    "https://raw.githubusercontent.com/argosopentech/argospm-index/main/index.json",
)
# Même dossier que la bibliothèque Argos : le cache Actions déjà rempli par
# les passages d'avant (paquets extraits) est relu tel quel.
DOSSIER = os.path.expanduser(
    os.environ.get("ARGOS_PACKAGES_DIR", "~/.local/share/argos-translate/packages")
)
LOT_PHRASES = int(os.environ.get("TRAD_LOT_PHRASES", "32"))
FAISCEAU = int(os.environ.get("TRAD_FAISCEAU", "4"))


def journal(*args):
    print(*args, file=sys.stderr, flush=True)


def paquets_installes():
    """(source, cible) → dossier du paquet, lu dans les metadata.json."""
    trouves = {}
    if not os.path.isdir(DOSSIER):
        return trouves
    for racine, _dirs, fichiers in os.walk(DOSSIER):
        if "metadata.json" not in fichiers:
            continue
        try:
            with open(os.path.join(racine, "metadata.json"), encoding="utf-8") as f:
                m = json.load(f)
        except Exception:
            continue
        cle = (m.get("from_code"), m.get("to_code"))
        if cle in PAIRES and os.path.isdir(os.path.join(racine, "model")):
            trouves[cle] = racine
    return trouves


def telecharger(manquants):
    try:
        with urllib.request.urlopen(INDEX, timeout=60) as r:
            index = json.load(r)
    except Exception as e:
        journal("Index des modèles illisible :", type(e).__name__)
        return
    os.makedirs(DOSSIER, exist_ok=True)
    for a, b in manquants:
        cand = [p for p in index if p.get("from_code") == a and p.get("to_code") == b and p.get("type", "translate") == "translate"]
        liens = [l for p in cand for l in (p.get("links") or []) if str(l).startswith("https://")]
        if not liens:
            journal("Modèle introuvable :", a, "→", b)
            continue
        zipdst = os.path.join(DOSSIER, "%s_%s.argosmodel" % (a, b))
        try:
            journal("Téléchargement du modèle", a, "→", b)
            urllib.request.urlretrieve(liens[0], zipdst)
            with zipfile.ZipFile(zipdst) as z:
                # Rien hors du dossier des modèles (chemins absolus, « .. »).
                for n in z.namelist():
                    if n.startswith("/") or ".." in n.split("/"):
                        raise ValueError("chemin refusé dans l'archive")
                z.extractall(DOSSIER)
        except Exception as e:
            journal("Échec du modèle", a, "→", b, ":", type(e).__name__)
        finally:
            try:
                os.remove(zipdst)
            except OSError:
                pass


class Modele:
    def __init__(self, dossier):
        import ctranslate2
        import sentencepiece as spm

        with open(os.path.join(dossier, "metadata.json"), encoding="utf-8") as f:
            meta = json.load(f)
        sp = os.path.join(dossier, "sentencepiece.model")
        if not os.path.exists(sp):
            raise RuntimeError("paquet sans sentencepiece.model")
        self.sp = spm.SentencePieceProcessor(model_file=sp)
        self.prefixe = meta.get("target_prefix") or ""
        self.tr = ctranslate2.Translator(
            os.path.join(dossier, "model"),
            device="cpu",
            inter_threads=1,
            intra_threads=os.cpu_count() or 0,
            compute_type="auto",
        )

    def phrases(self, phrases):
        """Liste de phrases → liste de traductions (même longueur)."""
        if not phrases:
            return []
        jetons = [self.sp.encode(p, out_type=str) for p in phrases]
        prefixe = [[self.prefixe]] * len(jetons) if self.prefixe else None
        res = self.tr.translate_batch(
            jetons,
            target_prefix=prefixe,
            replace_unknowns=True,
            max_batch_size=LOT_PHRASES,
            batch_type="examples",
            beam_size=FAISCEAU,
            length_penalty=0.2,
            # Garde contre les boucles du décodeur (« … the eyes of the eyes
            # of… ») : jamais plus de trois fois la longueur d'origine.
            max_decoding_length=min(512, 3 * max(len(j) for j in jetons) + 16),
        )
        sortie = []
        for r in res:
            v = self.sp.decode_pieces(r.hypotheses[0]).replace("▁", " ")
            if self.prefixe and v.startswith(self.prefixe):
                v = v[len(self.prefixe):]
            sortie.append(v.strip())
        return sortie


# Découpage en phrases : point, ! ? … ou ؟ suivi d'une espace puis d'une
# majuscule, d'un chiffre ou d'un guillemet. « M. Ouattara », « U.S. » et
# « 3.5 » ne coupent pas (pas d'espace, ou initiale isolée).
COUPURE = re.compile(r"(?<=[.!?…؟])\s+(?=[«\"“'(\[0-9A-ZÀ-ÖØ-Þ؀-ۿ])")
INITIALE = re.compile(r"(?:^|\s)(?:[A-Z]|M|Mme|Dr|St|Mr|Mrs|Gen|Col|Sgt|Lt|Capt|No|Art)\.$")


def decouper(texte):
    t = texte.strip()
    if len(t) < 160:
        return [t]
    morceaux, cour = [], ""
    for m in COUPURE.split(t):
        cour = (cour + " " + m).strip() if cour else m
        if INITIALE.search(cour):
            continue
        morceaux.append(cour)
        cour = ""
    if cour:
        morceaux.append(cour)
    return [m for m in morceaux if m]


def main():
    try:
        import ctranslate2  # noqa: F401
        import sentencepiece  # noqa: F401
    except Exception as e:
        journal("ctranslate2 ou sentencepiece absent :", type(e).__name__)
        return
    trouves = paquets_installes()
    manquants = [p for p in PAIRES if p not in trouves]
    if manquants:
        telecharger(manquants)
        trouves = paquets_installes()
    modeles = {}

    def modele(a, b):
        if (a, b) not in modeles:
            try:
                modeles[(a, b)] = Modele(trouves[(a, b)]) if (a, b) in trouves else None
            except Exception as e:
                journal("Modèle", a, "→", b, "inutilisable :", type(e).__name__, str(e)[:120])
                modeles[(a, b)] = None
        return modeles[(a, b)]

    def etape(textes, a, b):
        """Traduit une liste de textes d'un seul appel au modèle a→b."""
        m = modele(a, b)
        if m is None:
            return None
        decoupes = [decouper(t) for t in textes]
        plat = [p for d in decoupes for p in d]
        trad = m.phrases(plat)
        sortie, i = [], 0
        for d in decoupes:
            sortie.append(" ".join(x for x in trad[i:i + len(d)] if x).strip())
            i += len(d)
        return sortie

    def lot(textes, source, cible):
        if source == cible:
            return list(textes)
        if (source, cible) in trouves:
            return etape(textes, source, cible)
        # Pivot par l'anglais : pt → en → fr.
        if (source, "en") in trouves and ("en", cible) in trouves:
            milieu = etape(textes, source, "en")
            return etape(milieu, "en", cible) if milieu is not None else None
        return None

    print(json.dumps({"pret": True, "paires": sorted("%s>%s" % p for p in trouves)}), flush=True)
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
        if source and source != "auto" and cible and isinstance(lignes, list) and lignes:
            textes = [str(l) for l in lignes]
            try:
                res = lot(textes, source, cible)
            except Exception as e:
                # Un texte qui fait tomber le lot : on rejoue ligne par ligne,
                # il ne coûte que lui (null à sa place).
                journal("Lot en échec, reprise ligne par ligne :", type(e).__name__)
                res = []
                for t in textes:
                    try:
                        r = lot([t], source, cible)
                        res.append(r[0] if r else None)
                    except Exception:
                        res.append(None)
            if res is not None:
                sortie = [x.strip() if isinstance(x, str) and x.strip() else None for x in res]
        print(json.dumps({"id": rid, "lignes": sortie}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
