"""Publish the original mini-label artwork, printable PDF, and website previews."""
import hashlib
import html
import json
import shutil
from datetime import datetime
from pathlib import Path
import fitz
from mini_ticket_design import ROOT, MM, W, H, build_mini_pages, build_label_samples, build_design_overview

def prepare_mini_collection():
 destination=ROOT/'public/tickets/collections'
 artwork=ROOT/'public/tickets/mini-design-v3'
 output=ROOT/'output/tickets/mini-design-v3'
 for folder in [destination,artwork,output]:folder.mkdir(parents=True,exist_ok=True)
 registry=ROOT/'src/ticketCollections.json'
 records=json.loads(registry.read_text(encoding='utf-8-sig'))
 before={r['id']:hashlib.sha256((ROOT/('public'+r['pdf'].split('?')[0])).read_bytes()).hexdigest() for r in records if r['id']!='mini-tiramisu'}
 old=next((r for r in records if r['id']=='mini-tiramisu'),None)
 if old and old.get('designRevision')!=3:
  archive=ROOT/'backups'/('mini-tickets-before-new-design-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
  archive.mkdir(parents=True,exist_ok=True);shutil.copy2(registry,archive/'ticketCollections.json')
  shutil.copy2(ROOT/('public'+old['pdf'].split('?')[0]),archive/old['filename'])
 filename='ARIMA_Mini_Tiramisus_Collection_Couleurs.pdf'
 pdf=destination/filename
 flavours,placements=build_mini_pages(pdf,paired=True)
 build_label_samples(artwork)
 digest=hashlib.sha256(pdf.read_bytes()).hexdigest();version=digest[:12]
 page_images=[]
 with fitz.open(pdf) as document:
  assert len(document)==5
  for index,page in enumerate(document,1):
   assert abs(page.rect.width/MM-210)<.01 and abs(page.rect.height/MM-297)<.01
   text=page.get_text()
   assert text.count('MINI TIRAMISU')==8
   for flavour in flavours[(index-1)*2:index*2]:
    expected=flavour['name'].replace(' ','\n') if flavour['id']=='kinder' else flavour['name']
    assert text.count(expected)==4,(index,expected,text)
   name=f'mini-new-design-page-{index:02}.webp'
   page.get_pixmap(matrix=fitz.Matrix(1.8,1.8),alpha=False).pil_save(str(destination/name),format='WEBP',quality=96)
   page_images.append('/tickets/collections/'+name+'?v='+version)
 for flavour in flavours:
  with fitz.open(artwork/f"label-{flavour['id']}.pdf") as document:
   assert abs(document[0].rect.width/MM-44)<.01 and abs(document[0].rect.height/MM-27.5)<.01
   document[0].get_pixmap(matrix=fitz.Matrix(6,6),alpha=False).pil_save(str(artwork/f"label-{flavour['id']}.webp"),format='WEBP',quality=96)
 # The library card shows an enlarged design, rather than a tiny A4 thumbnail.
 preview='/tickets/mini-design-v3/label-pistache.webp?v='+version
 printfile=destination/'mini-colour-collection-print.html'
 template=(ROOT/'public/tickets/original-1-print.html').read_text(encoding='utf-8')
 start=template.index('<section>');end=template.index('<script>',start)
 sheets=''.join(f'<section><img src="{src}" alt="Page {index}"/></section>' for index,src in enumerate(page_images,1))
 template=template[:start]+sheets+template[end:]
 template=template.replace('Rectangles illustrés','Mini tiramisus - Nouveau design').replace('/tickets/original-1.pdf','/tickets/collections/'+filename+'?v='+version).replace('Arima_Flavors_Separated_Rectangles.pdf',filename).replace('PDF original','Télécharger le PDF')
 printfile.write_text(template,encoding='utf-8')
 designs=[{'id':f['id'],'name':f['name'],'preview':f"/tickets/mini-design-v3/label-{f['id']}.webp?v={version}",'color':f['tint'],'ink':f['ink']} for f in flavours]
 entry={'id':'mini-tiramisu','filename':filename,'title':'Mini tiramisus','group':'mini','description':'10 saveurs, 10 illustrations gourmandes et palettes distinctes. 4 tickets par goût, 2 goûts par page.','pages':5,'modelCount':10,'ticketsPerPage':8,'ticketsPerFlavour':4,'flavoursPerPage':2,'dimensions':'44 × 27,5 mm','pdf':'/tickets/collections/'+filename+'?v='+version,'preview':preview,'pageImages':page_images,'print':'/tickets/collections/'+printfile.name+'?v='+version,'tag':'10 UNIVERS GOURMANDS','designRevision':3,'flavours':[f['name'] for f in flavours],'designs':designs}
 records=[entry if r['id']=='mini-tiramisu' else r for r in records]
 if not old:records.append(entry)
 registry.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
 (ROOT/'output/pdf').mkdir(parents=True,exist_ok=True);shutil.copy2(pdf,ROOT/'output/pdf'/filename)
 for r in records:
  if r['id']!='mini-tiramisu':assert hashlib.sha256((ROOT/('public'+r['pdf'].split('?')[0])).read_bytes()).hexdigest()==before[r['id']]
 build_design_overview(output/'design-overview.pdf')
 with fitz.open(output/'design-overview.pdf') as overview:
  overview[0].get_pixmap(matrix=fitz.Matrix(2,2),alpha=False).save(output/'design-overview.png')
 validation={'design':'Ten independently generated full-colour flavour illustrations, native-size vector type','artworkDirectory':'public/tickets/mini-design-v3','sizeMM':[44,27.5],'flavours':flavours,'pages':5,'ticketsPerFlavour':4,'flavoursPerPage':2,'placements':placements,'minimumFontPoints':5.1,'pdfSha256':digest,'otherCollectionsUnchanged':True}
 (output/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'pdf':str(pdf),'pages':5,'miniFlavours':[f['name'] for f in flavours],'sizeMM':[44,27.5],'designRevision':3},ensure_ascii=False))
 return entry

if __name__=='__main__':prepare_mini_collection()
