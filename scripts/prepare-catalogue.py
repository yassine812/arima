"""Prepare faithful page images and a print view; preserve the supplied PDF bytes."""
import argparse
import hashlib
import html
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LABELS = [
    'Couverture', 'Liste des prix',
    'Cheesecakes : noisette, Oreo chocolat, pistache et citron',
    'Tiramisus : noisette, framboise, Kinder Bueno et Kids',
    'Tiramisus : pistache, fraise, classique et citron',
    'Tiramisus : spéculoos et Raffaello',
    'Cheesecakes : caramel, Oreo, chocolat et fraise',
]


def prepare(source: Path, labels=None, replace_version=None):
    destination = ROOT / 'public' / 'catalogue'
    destination.mkdir(parents=True, exist_ok=True)
    pdf = destination / 'ARIMA_Catalogue_Final.pdf'
    if source.resolve() != pdf.resolve():
        shutil.copy2(source, pdf)
    with fitz.open(source) as document:
        if not len(document):
            raise ValueError('The catalogue contains no pages.')
        if labels is not None and len(labels) != len(document):
            raise ValueError('Supply exactly one reading label per PDF page.')
        labels = labels if labels is not None else LABELS
        pages = []
        for index, page in enumerate(document):
            pixels = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
            image = Image.frombytes('RGB', (pixels.width, pixels.height), pixels.samples)
            filename = f'page-{index + 1:02d}.webp'
            image.save(destination / filename, 'WEBP', quality=94, method=4)
            image.thumbnail((180, 260))
            thumbnail = f'thumb-{index + 1:02d}.webp'
            image.save(destination / thumbnail, 'WEBP', quality=86, method=4)
            pages.append({
                'number': index + 1,
                'label': labels[index] if index < len(labels) else f'Page {index + 1}',
                'src': f'/catalogue/{filename}',
                'thumbnail': f'/catalogue/{thumbnail}',
            })
        metadata = {
            'title': 'Le catalogue ARIMA',
            'pdf': '/catalogue/ARIMA_Catalogue_Final.pdf',
            'pageCount': len(document),
            'pageWidth': document[0].rect.width,
            'pageHeight': document[0].rect.height,
            'byteSize': pdf.stat().st_size,
            'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
            'pages': pages,
        }
    (ROOT / 'src' / 'catalogueData.ts').write_text(
        '// Prepared from the original ARIMA PDF by scripts/prepare-catalogue.py.\n'
        + 'export const catalogue = ' + json.dumps(metadata, ensure_ascii=False, indent=2)
        + ' as const;\n', encoding='utf-8')
    images = '\n'.join(
        f'<section class="print-page"><img src="{p["src"]}" '
        f'alt="Page {p["number"]} : {html.escape(p["label"])}"></section>' for p in pages)
    print_document = '''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Imprimer le catalogue ARIMA</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#ece4d7;color:#513a33;font-family:system-ui,sans-serif}
.print-tools{position:sticky;top:0;display:flex;align-items:center;justify-content:center;gap:16px;padding:16px;background:#fff8eb;box-shadow:0 1px 8px #513a3320;z-index:2;font-size:13px}
.print-tools button,.print-tools a{border:1px solid #b58c70;border-radius:10px;padding:10px 15px;background:#805746;color:#fff9ef;font:inherit;text-decoration:none;cursor:pointer}
.print-tools a{background:white;color:#805746}.print-tools button:disabled{opacity:.5}
.print-page{width:min(210mm,100%);margin:20px auto;background:white;box-shadow:0 3px 20px #513a3320}
.print-page img{display:block;width:100%;height:auto}
@page{size:A4 portrait;margin:0}
@media print{html,body{margin:0;background:white}.print-tools{display:none}.print-page{width:210mm;height:297mm;margin:0;box-shadow:none;break-after:page;page-break-after:always;overflow:hidden}.print-page:last-child{break-after:auto;page-break-after:auto}.print-page img{width:100%;height:100%;object-fit:contain}}
</style></head><body>
<header class="print-tools"><span id="print-status" role="status">Préparation des pages…</span><button id="print-catalogue" disabled>Imprimer</button><a href="/catalogue/ARIMA_Catalogue_Final.pdf" download="ARIMA_Catalogue_Final.pdf">Télécharger le PDF</a></header>
''' + images + '''
<script>
const button=document.getElementById('print-catalogue');
const status=document.getElementById('print-status');
let ready=false;
button.addEventListener('click',()=>{if(ready)window.print()});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data==='arima-print-catalogue'&&ready)window.print()});
window.addEventListener('afterprint',()=>{if(window.parent!==window)window.parent.postMessage('arima-catalogue-print-finished',location.origin)});
Promise.all(Array.from(document.images,img=>img.decode())).then(()=>{
 ready=true;button.disabled=false;status.textContent='Le catalogue ARIMA · 7 pages';
 if(window.parent!==window)window.parent.postMessage('arima-catalogue-print-ready',location.origin);
 if(new URLSearchParams(location.search).get('auto')==='1')window.print();
}).catch(()=>{status.textContent='Une page n’a pas pu être chargée. Rechargez cette fenêtre.';if(window.parent!==window)window.parent.postMessage('arima-catalogue-print-error',location.origin)});
</script></body></html>'''
    print_document = print_document.replace('Le catalogue ARIMA · 7 pages', f'Le catalogue ARIMA · {len(pages)} pages')
    (destination / 'print.html').write_text(print_document, encoding='utf-8')
    # Keep each saved edition and its original save time, even when rebuilt.
    registry = ROOT / 'src' / 'catalogueVersions.json'
    versions = json.loads(registry.read_text(encoding='utf-8')) if registry.exists() else []
    previous = next((v for v in versions if v['version'] == replace_version), None)
    if replace_version is not None and (replace_version <= 1 or previous is None):
        raise ValueError('Only an existing edition after Version 1 can be revised.')
    if not any(version['sha256'] == metadata['sha256'] for version in versions):
        number = replace_version if previous else max((v['version'] for v in versions), default=0) + 1
        revision = previous.get('revision', 1) + 1 if previous else 1
        archive = destination / 'versions' / f'v{number}'
        if previous:
            archive = archive / f'revision-{revision}'
        archive.mkdir(parents=True, exist_ok=False)
        prefix = f'/catalogue/versions/v{number}' + (f'/revision-{revision}' if previous else '')
        for item in destination.iterdir():
            if item.is_file():
                shutil.copy2(item, archive / item.name)
        archived_print = print_document.replace('/catalogue/', prefix + '/')
        (archive / 'print.html').write_text(archived_print, encoding='utf-8')
        edition = {**metadata, 'version': number, 'savedAt': datetime.now(timezone.utc).isoformat(),
                   'pdf': prefix + '/ARIMA_Catalogue_Final.pdf', 'print': prefix + '/print.html',
                   'pages': [{**p, 'src': p['src'].replace('/catalogue', prefix),
                              'thumbnail': p['thumbnail'].replace('/catalogue', prefix)} for p in pages]}
        if previous:
            edition.update({'revision': revision, 'firstSavedAt': previous.get('firstSavedAt', previous['savedAt']), 'previousSha256': previous['sha256']})
            versions[versions.index(previous)] = edition
        else:
            versions.append(edition)
        registry.write_text(json.dumps(versions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'pages': len(pages), 'pdfBytes': metadata['byteSize'], 'sha256': metadata['sha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--labels', type=Path, help='JSON array with one accessible label per page')
    parser.add_argument('--replace-version', type=int, help='Revise an existing edition, preserving its previous assets')
    args = parser.parse_args()
    prepare(args.pdf, json.loads(args.labels.read_text(encoding='utf-8')) if args.labels else None, args.replace_version)
