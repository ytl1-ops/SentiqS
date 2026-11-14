#!/usr/bin/env python3
"""Images de partage (Open Graph / Twitter), 14/11/2026.

Une image par langue, 1200 × 630 (format recommandé par Facebook, LinkedIn,
X, WhatsApp). Même signe et mêmes couleurs que les icônes de l'application
(scripts/icones-app.py). Les fichiers produits sont commités : Pillow n'est
pas nécessaire en CI.

    python3 scripts/image-partage.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(__file__)
RACINE = os.path.join(ICI, '..')
# Seules les définitions d'icones-app.py sont reprises (jusqu'à `def ecrire`) :
# le reste du fichier réécrit toutes les icônes à l'import.
_src = open(os.path.join(ICI, 'icones-app.py'), encoding='utf-8').read()
icones = type('icones', (), {})
_ns = {'__file__': os.path.join(ICI, 'icones-app.py')}
exec(compile(_src[:_src.index('def ecrire')], 'icones-app.py', 'exec'), _ns)
for _k in ('FOND', 'FOND2', 'OR', 'icone'):
    setattr(icones, _k, staticmethod(_ns[_k]) if callable(_ns[_k]) else _ns[_k])

L, H = 1200, 630
FOND, FOND2, OR = icones.FOND, icones.FOND2, icones.OR
BLANC, PALE = (245, 247, 250), (190, 202, 222)
POLICES = '/usr/share/fonts/truetype/dejavu/'

TEXTES = {
    'fr': ('Veille sûreté sur les 54 pays d’Afrique',
           'Niveaux d’alerte, faits cotés et recoupés,',
           'bulletin quotidien et rapports pour les décideurs.'),
    'en': ('Security monitoring across all 54 African countries',
           'Alert levels, rated and cross-checked facts,',
           'a daily bulletin and reports for decision-makers.'),
}


def police(nom, taille):
    return ImageFont.truetype(POLICES + nom, taille)


def fond():
    im = Image.new('RGB', (L, H), FOND)
    px = im.load()
    for y in range(H):
        for x in range(L):
            t = min(1.0, ((x - 300) ** 2 + (y - 200) ** 2) ** .5 / 1100)
            px[x, y] = tuple(round(FOND2[i] * (1 - t) + FOND[i] * t) for i in range(3))
    return im


def image(langue):
    im = fond()
    d = ImageDraw.Draw(im)
    signe = icones.icone(200, echelle=0.8)
    im.paste(signe, (80, 90))
    d.text((310, 105), 'SentiqS', font=police('DejaVuSerif-Bold.ttf', 96), fill=BLANC)
    d.rectangle([314, 232, 474, 237], fill=OR)
    titre, l1, l2 = TEXTES[langue]
    f = 50
    while police('DejaVuSans-Bold.ttf', f).getlength(titre) > L - 160 and f > 30:
        f -= 2
    d.text((80, 340), titre, font=police('DejaVuSans-Bold.ttf', f), fill=BLANC)
    d.text((80, 425), l1, font=police('DejaVuSans.ttf', 32), fill=PALE)
    d.text((80, 470), l2, font=police('DejaVuSans.ttf', 32), fill=PALE)
    d.text((80, 552), 'sentiqs-235ce.web.app', font=police('DejaVuSansMono.ttf', 26), fill=OR)
    return im


if __name__ == '__main__':
    for langue in TEXTES:
        chemin = os.path.join(RACINE, 'web', 'assets', 'partage-' + langue + '.png')
        image(langue).save(chemin, optimize=True)
        print(chemin, os.path.getsize(chemin))
