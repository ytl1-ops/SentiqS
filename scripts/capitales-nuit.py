#!/usr/bin/env python3
"""Candidats d'images « capitale africaine de nuit » pour la page de garde.

Demande de l'editeur du 20/10/2026 : des vues de nuit de grandes capitales
africaines, en fondu derriere le titre de la page d'accueil. Ce script ne
publie rien : il cherche sur Wikimedia Commons des photos sous licence LIBRE
(CC0, domaine public, CC BY, CC BY-SA — jamais NC ni ND), les telecharge en
1600 px et ecrit, pour chacune, l'auteur, la licence et la page source, sans
lesquels l'image ne peut pas etre affichee. Le choix final est fait a l'oeil,
image par image : un resultat de recherche n'est pas une garantie qu'il
s'agit bien de la ville, ni de nuit.

    python3 scripts/capitales-nuit.py dossier-de-sortie
"""
import json, os, re, subprocess, sys, urllib.parse, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else 'capitales-nuit'
VILLES = {
    'abidjan': ['Abidjan night', 'Plateau Abidjan night'],
    'dakar': ['Dakar night', 'Dakar skyline night'],
    'lagos': ['Lagos night skyline', 'Lekki bridge night'],
    'nairobi': ['Nairobi skyline night', 'Nairobi night'],
    'le-caire': ['Cairo skyline night', 'Cairo night Nile'],
    'johannesburg': ['Johannesburg skyline night', 'Johannesburg night'],
    'casablanca': ['Casablanca night', 'Hassan II Mosque night'],
    'accra': ['Accra night'],
    'kigali': ['Kigali night'],
    'addis-abeba': ['Addis Ababa night'],
    'luanda': ['Luanda night'],
    'kinshasa': ['Kinshasa night'],
}
LIBRES = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)', re.I)
UA = {'User-Agent': 'SentiqS-page-de-garde/1.0 (https://github.com/ytl1-ops/SentiqS)'}

def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(dict(params, format='json'))
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)

def nettoie(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html or '')).strip()

os.makedirs(OUT, exist_ok=True)
credits = []
for ville, requetes in VILLES.items():
    vus, n = set(), 0
    for q in requetes:
        d = api({'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6,
                 'gsrlimit': 12, 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 1600})
        pages = sorted((d.get('query') or {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
        for p in pages:
            if n >= 4 or p['title'] in vus:
                continue
            vus.add(p['title'])
            ii = (p.get('imageinfo') or [{}])[0]
            meta = ii.get('extmetadata') or {}
            lic = nettoie((meta.get('LicenseShortName') or {}).get('value'))
            if not LIBRES.match(lic) or ii.get('width', 0) < 1400 or ii.get('width', 0) < ii.get('height', 1):
                continue
            nom = f'{ville}-{n + 1}.jpg'
            brut = os.path.join(OUT, 'brut-' + nom)
            with urllib.request.urlopen(urllib.request.Request(ii['thumburl'], headers=UA), timeout=60) as r, open(brut, 'wb') as f:
                f.write(r.read())
            subprocess.run(['convert', brut, '-resize', '1600x>', '-strip', '-interlace', 'Plane', '-quality', '72', os.path.join(OUT, nom)], check=True)
            os.remove(brut)
            credits.append({'fichier': nom, 'ville': ville, 'titre': p['title'], 'auteur': nettoie((meta.get('Artist') or {}).get('value')),
                            'licence': lic, 'licence_url': nettoie((meta.get('LicenseUrl') or {}).get('value')),
                            'source': ii.get('descriptionurl'), 'description': nettoie((meta.get('ImageDescription') or {}).get('value'))[:200]})
            n += 1
    print(ville, n, 'candidat(s)')
with open(os.path.join(OUT, 'credits.json'), 'w', encoding='utf-8') as f:
    json.dump(credits, f, ensure_ascii=False, indent=1)
