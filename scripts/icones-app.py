#!/usr/bin/env python3
"""Icônes de l'application (web installable et Android), 13/11/2026.

Dessinées ici plutôt que tirées d'une banque d'images : même signe que la
pastille de la barre de navigation de l'accueil (cercle, cercle pointillé,
point central — un radar), aux couleurs « bleu nuit » et or de l'appli.
Relancer ce script régénère tous les fichiers ; les fichiers produits sont
commités, Pillow n'est donc pas nécessaire en CI.

    python3 scripts/icones-app.py
"""
import math, os
from PIL import Image, ImageDraw, ImageFont

RACINE = os.path.join(os.path.dirname(__file__), '..')
FOND, FOND2, OR = (7, 20, 49), (15, 36, 80), (230, 186, 110)


def degrade(taille):
    im = Image.new('RGB', (taille, taille), FOND)
    px = im.load()
    c = taille / 2
    for y in range(taille):
        for x in range(taille):
            d = min(1.0, math.hypot(x - c, y - c) / (taille * 0.72))
            px[x, y] = tuple(round(FOND2[i] * (1 - d) + FOND[i] * d) for i in range(3))
    return im


def signe(im, echelle):
    """Le radar, centré, de diamètre echelle × côté."""
    s = 4  # suréchantillonnage pour des bords lisses
    T = im.size[0] * s
    calque = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    c, r = T / 2, T * echelle / 2
    w = max(2, round(r * 0.11))
    d.ellipse([c - r, c - r, c + r, c + r], outline=OR, width=w)
    r2 = r * 0.47
    n = 12
    for k in range(n):  # cercle pointillé
        a0 = 360 * k / n
        d.arc([c - r2, c - r2, c + r2, c + r2], a0, a0 + 360 / n * 0.58, fill=OR, width=max(2, round(w * 0.8)))
    r3 = r * 0.22
    d.ellipse([c - r3, c - r3, c + r3, c + r3], fill=OR)
    calque = calque.resize(im.size, Image.LANCZOS)
    im.paste(calque, (0, 0), calque)
    return im


def icone(taille, echelle=0.62, rond=False):
    im = signe(degrade(taille), echelle)
    if rond:
        masque = Image.new('L', (taille * 4, taille * 4), 0)
        ImageDraw.Draw(masque).ellipse([0, 0, taille * 4 - 1, taille * 4 - 1], fill=255)
        masque = masque.resize((taille, taille), Image.LANCZOS)
        out = Image.new('RGBA', (taille, taille), (0, 0, 0, 0))
        out.paste(im, (0, 0), masque)
        return out
    return im


def ecrire(im, *chemin):
    p = os.path.join(RACINE, *chemin)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, optimize=True)
    print(p)


# Web installable (manifeste) — « maskable » : le signe tient dans la zone
# sûre de 80 % que le système peut rogner en cercle ou en goutte.
ecrire(icone(192), 'web', 'icons', 'icone-192.png')
ecrire(icone(512), 'web', 'icons', 'icone-512.png')
ecrire(icone(512, 0.5), 'web', 'icons', 'icone-maskable-512.png')
ecrire(icone(180), 'web', 'icons', 'apple-touch-icon.png')

# Android : lanceur classique et rond, par densité.
for dossier, t in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    ecrire(icone(t), 'android', 'app', 'src', 'main', 'res', 'mipmap-' + dossier, 'ic_launcher.png')
    ecrire(icone(t, rond=True), 'android', 'app', 'src', 'main', 'res', 'mipmap-' + dossier, 'ic_launcher_round.png')
    ecrire(signe(degrade(t * 2), 0.42), 'android', 'app', 'src', 'main', 'res', 'drawable-' + dossier, 'splash.png')

# Fiche Play Store : icône 512 × 512 et bannière 1024 × 500.
ecrire(icone(512), 'store', 'play', 'icone-512.png')
ban = Image.new('RGB', (1024, 500), FOND)
fond = degrade(1024).resize((1024, 1024)).crop((0, 262, 1024, 762))
ban.paste(fond, (0, 0))
ban.paste(signe(ban.crop((90, 120, 350, 380)), 0.62), (90, 120))
d = ImageDraw.Draw(ban)
def police(t, gras=False):
    for nom in (['DejaVuSerif-Bold.ttf', 'DejaVuSans-Bold.ttf'] if gras else ['DejaVuSans.ttf']):
        for base in ['/usr/share/fonts/truetype/dejavu/', '']:
            try:
                return ImageFont.truetype(base + nom, t)
            except OSError:
                pass
    return ImageFont.load_default()
d.text((400, 165), 'SentiqS', font=police(84, True), fill=OR)
d.text((404, 275), 'Veille de sûreté sur l\'Afrique', font=police(34), fill=(235, 240, 248))
d.text((404, 322), '54 pays · niveaux d\'alerte · rapports', font=police(26), fill=(170, 186, 210))
ecrire(ban, 'store', 'play', 'banniere-1024x500.png')
