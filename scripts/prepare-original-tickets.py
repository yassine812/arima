"""Expose original PDF bytes and faithful previews without redesigning any ticket."""
import hashlib
import html
import json
import shutil
from pathlib import Path
import fitz

ROOT=Path(__file__).resolve().parent.parent
BASE=Path('C:/Users/Yassine/Downloads/Projets et travail/ARIMA')
DEST=ROOT/'public/tickets'
DEST.mkdir(parents=True,exist_ok=True)
SOURCES=[
 ('Arima_Flavors_Separated_Rectangles.pdf','Rectangles illustrés','rectangles','Tickets illustrés avec grille de découpe.'),
 ('Arima_Flavors_4xSame_Per_Page.pdf','4 tickets identiques par page','rectangles','Une saveur par page, quatre tickets identiques.'),
 ('merged_ARIMA_catalog.pdf','Bandelettes tiramisu','tiramisu','Les bandelettes de tiramisu du fichier fourni.'),
 ('ARIMA_catalog_with_pistache.pdf','Bandelettes avec pistache','tiramisu','Le modèle tiramisu avec la saveur pistache.'),
]
records=[]
for index,(filename,title,group,description) in enumerate(SOURCES,1):
 source=BASE/filename;pdf=DEST/f'original-{index}.pdf';shutil.copy2(source,pdf)
 assert source.read_bytes()==pdf.read_bytes()
 images=[]
 with fitz.open(pdf) as doc:
  sizes=[]
  for page_index,page in enumerate(doc,1):
   image=DEST/f'original-{index}-page-{page_index:02}.webp'
   page.get_pixmap(matrix=fitz.Matrix(1.75,1.75),alpha=False).pil_save(str(image),format='WEBP',quality=96)
   images.append('/tickets/'+image.name);sizes.append([page.rect.width*25.4/72,page.rect.height*25.4/72])
  count=len(doc)
  doc[0].get_pixmap(matrix=fitz.Matrix(.8,.8),alpha=False).pil_save(str(DEST/f'original-{index}.webp'),format='WEBP',quality=94)
 assert all(abs(w-210)<.1 and abs(h-297)<.1 for w,h in sizes),'Print CSS must match the original page size'
 printfile=DEST/f'original-{index}-print.html'
 sheets=''.join(f'<section><img src="{image}" alt="Page {i}"/></section>' for i,image in enumerate(images,1))
 printfile.write_text('''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'''+html.escape(title)+''' - ARIMA</title><style>*{box-sizing:border-box}body{margin:0;background:#e9e1d5;color:#614735;font:13px system-ui}header{position:sticky;top:0;z-index:2;background:#fff9ef;padding:16px;display:flex;gap:18px;align-items:center;justify-content:center;flex-wrap:wrap}button,a{font:inherit;border-radius:9px;padding:10px 15px;border:1px solid #c9a585;background:#805746;color:#fff9ef;text-decoration:none;cursor:pointer}button:disabled{opacity:.4}section{width:210mm;max-width:100%;margin:20px auto;background:white;box-shadow:0 3px 20px #61473522}section img{display:block;width:100%;height:auto}@page{size:A4 portrait;margin:0}@media print{html,body{background:white;margin:0}header{display:none}section{width:210mm;max-width:none;height:297mm;margin:0;box-shadow:none;break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}section img{width:210mm;height:297mm;object-fit:contain;print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><header><strong>'''+html.escape(title)+'''</strong><span>A4 · taille réelle 100 % · sans en-têtes ni pieds de page</span><button id="print" disabled>Chargement…</button><a href="/tickets/'''+pdf.name+'''" download="'''+html.escape(filename)+'''">PDF original</a><span id="status" role="status"></span></header>'''+sheets+'''<script>const b=document.getElementById('print');Promise.all(Array.from(document.images,i=>i.decode())).then(()=>{b.disabled=false;b.textContent='Imprimer'}).catch(()=>document.getElementById('status').textContent='Une page ne charge pas. Rechargez la fenêtre.');b.onclick=()=>window.print();</script></body></html>''',encoding='utf-8')
 records.append({'id':f'original-{index}','filename':filename,'title':title,'group':group,'description':description,'pages':count,'pdf':f'/tickets/{pdf.name}','preview':f'/tickets/original-{index}.webp','pageImages':images,'print':f'/tickets/{printfile.name}','sha256':hashlib.sha256(pdf.read_bytes()).hexdigest()})
(ROOT/'src/ticketOriginals.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'file':r['filename'],'pages':r['pages'],'sha256':r['sha256']} for r in records]))
