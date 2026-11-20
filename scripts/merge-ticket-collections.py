"""Deduplicate flavours and pair four-ticket blocks only when they fit at real size."""
import hashlib
import html
import json
import shutil
from datetime import datetime
from io import BytesIO
from pathlib import Path
import fitz
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'public/tickets/collections'
OUT=ROOT/'output/pdf'
AUDIT=ROOT/'output/tickets/merged'
for directory in (DEST,OUT,AUDIT):directory.mkdir(parents=True,exist_ok=True)
MM=72/25.4
registry=ROOT/'src/ticketCollections.json'
if registry.exists():
 previous=json.loads(registry.read_text(encoding='utf-8-sig'))
 if not any(c.get('flavoursPerPage')==2 for c in previous):
  archive=ROOT/'backups'/('tickets-before-paired-flavours-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
  archive.mkdir(parents=True,exist_ok=True)
  shutil.copy2(registry,archive/'ticketCollections.json')
  for c in previous:
   p=ROOT/('public'+c['pdf'].split('?')[0])
   if p.exists():shutil.copy2(p,archive/p.name)
  for file in AUDIT.glob('*.json'):
   shutil.copy2(file,archive/file.name)

def artwork_hash(doc,page):
 info=page.get_images(full=True)[0]
 # Compare original image and mask streams without touching MuPDF's image cache.
 payload=doc.xref_stream(info[0])
 if info[1]:payload+=doc.xref_stream(info[1])
 return hashlib.sha256(payload).hexdigest()

def merge_pages(numbers,kind,title):
 output=fitz.open();seen={};records=[];removed=[]
 for number in numbers:
  source=ROOT/f'public/tickets/original-{number}.pdf'
  with fitz.open(source) as document:
   for index,page in enumerate(document):
    assert len(page.get_image_info())==4
    digest=artwork_hash(document,page)
    origin={'source':source.name,'sourcePage':index+1,'artworkSha256':digest}
    if digest in seen:
     removed.append({**origin,'sameAsOutputPage':seen[digest]});continue
    output.insert_pdf(document,from_page=index,to_page=index)
    # Byte-for-byte equality of rendered pixels proves the entire page layout is preserved.
    before=page.get_pixmap(matrix=fitz.Matrix(.75,.75),alpha=False)
    after=output[-1].get_pixmap(matrix=fitz.Matrix(.75,.75),alpha=False)
    assert before.samples==after.samples,(kind,index,'page layout changed')
    assert len(output[-1].get_image_info())==4
    records.append({**origin,'outputPage':len(output),'fullPageRenderingUnchanged':True})
    seen[digest]=len(output)
 output.set_metadata({'title':f'ARIMA - {title} - 4 tickets par page','author':'Maison ARIMA'})
 filename=f'ARIMA_Tickets_{kind}.pdf'
 output.save(DEST/filename,garbage=4,deflate=True);output.close()
 return filename,records,removed

illustrated,rect_records,rect_removed=merge_pages([1,2],'illustrated','Tickets illustrés')
tiramisu,strip_records,strip_removed=merge_pages([3,4],'tiramisu','Bandelettes tiramisu')
assert len(rect_records)==10 and len(rect_removed)==10
assert len(strip_records)==9 and len(strip_removed)==8

def publish_combined():
 combined=fitz.open()
 for filename in [illustrated,tiramisu]:
  with fitz.open(DEST/filename) as source:combined.insert_pdf(source)
 combined_name='ARIMA_Tickets_Fusionnes.pdf'
 count=len(combined)
 combined.set_metadata({'title':'ARIMA - Tickets réunis - 4 par goût','author':'Maison ARIMA'})
 combined.save(DEST/combined_name,garbage=4,deflate=True);combined.close()
 shutil.copy2(DEST/combined_name,OUT/combined_name)
 version=hashlib.sha256((DEST/combined_name).read_bytes()).hexdigest()[:12]
 (ROOT/'src/ticketMerge.json').write_text(json.dumps({'pdf':'/tickets/collections/'+combined_name+'?v='+version,'filename':combined_name,'pages':count,'ticketsPerFlavour':4},ensure_ascii=False,indent=2),encoding='utf-8')

# Only the new mini edition is generated: four identical, half-size tickets on A4.
mini_filename='ARIMA_Tickets_mini-tiramisu.pdf'
mini_positions=[]
for row in range(2):
 for col in range(2):mini_positions.append({'x':61+44*col,'y':27.5+27.5*row,'width':44,'height':27.5})
from mini_ticket_design import build_mini_pages
build_mini_pages(DEST/mini_filename,paired=False)
with fitz.open(DEST/mini_filename) as document:
 assert len(document)==10
 assert all(len(p.get_image_info())==4 for p in document)

def ticket_bounds(page):
 rectangles=[fitz.Rect(image['bbox']) for image in page.get_image_info()]
 rectangles.extend(drawing['rect'] for drawing in page.get_drawings())
 # Horizontal/vertical cutting lines have zero-area bounds; rectangle union
 # ignores them, so include their endpoints explicitly.
 bounds=fitz.Rect(min(r.x0 for r in rectangles),min(r.y0 for r in rectangles),max(r.x1 for r in rectangles),max(r.y1 for r in rectangles))
 # Include the outer half of the cutting-line stroke instead of clipping it.
 return bounds+(-.5,-.5,.5,.5)

def pair_flavours(filename):
 """Place up to two complete 2x2 blocks without scaling or adding any copies."""
 source=fitz.open(DEST/filename);output=fitz.open();mapping=[];index=0
 gap=12*MM
 while index<len(source):
  first=source[index];a=ticket_bounds(first)
  pair=False
  if index+1<len(source):
   b=ticket_bounds(source[index+1])
   pair=max(a.width,b.width)<=190*MM and a.y0+a.height+gap+b.height<=287*MM
  if not pair:
   output.insert_pdf(source,from_page=index,to_page=index)
   mapping.append({'outputPage':len(output),'sourcePages':[index+1],'tickets':4,'scaled':False})
   index+=1;continue
  page=output.new_page(width=210*MM,height=297*MM)
  destinations=[a,fitz.Rect(b.x0,a.y1+gap,b.x1,a.y1+gap+b.height)]
  for offset,(clip,destination) in enumerate(zip([a,b],destinations)):
   assert abs(clip.width-destination.width)<.001 and abs(clip.height-destination.height)<.001
   assert destination.y1<=287*MM
   page.show_pdf_page(destination,source,index+offset,clip=clip,keep_proportion=True)
  assert destinations[0].y1<destinations[1].y0
  assert len(page.get_image_info())==8
  mapping.append({'outputPage':len(output),'sourcePages':[index+1,index+2],'tickets':8,'scaled':False,'destinations':[list(r) for r in destinations]})
  index+=2
 output.set_metadata({'title':'ARIMA - 4 tickets par goût - 2 goûts lorsque le format le permet','author':'Maison ARIMA'})
 temporary=DEST/(filename+'.tmp.pdf')
 output.save(temporary,garbage=4,deflate=True);output.close();source.close();temporary.replace(DEST/filename)
 return mapping

packed={kind:pair_flavours(filename) for kind,filename in [('illustrated',illustrated),('tiramisu',tiramisu),('mini-tiramisu',mini_filename)]}
assert len(packed['illustrated'])==5 and len(packed['tiramisu'])==9 and len(packed['mini-tiramisu'])==5
publish_combined()

collections=[]
configs=[('illustrated','Tickets illustrés','rectangles',illustrated,rect_records,'88 × 55 mm','Fusion des deux PDF illustrés ; pages d’origine conservées.'),('tiramisu','Bandelettes tiramisu','tiramisu',tiramisu,strip_records,'Dimensions d’origine','Fusion des deux PDF tiramisu, pistache incluse ; pages d’origine conservées.'),('mini-tiramisu','Mini tiramisus','mini',mini_filename,rect_records,'44 × 27,5 mm','Mêmes illustrations en format réduit, avec 4 mini tickets par page.')]
for kind,title,group,filename,records,dimensions,detail in configs:
 pdf=DEST/filename;shutil.copy2(pdf,OUT/filename)
 version=hashlib.sha256(pdf.read_bytes()).hexdigest()[:12]
 root='/tickets/collections/'
 images=[]
 with fitz.open(pdf) as document:
  for index,page in enumerate(document,1):
   image_name=f'{kind}-page-{index:02}.webp'
   page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),alpha=False).pil_save(str(DEST/image_name),format='WEBP',quality=95)
   images.append(root+image_name+'?v='+version)
  document[0].get_pixmap(matrix=fitz.Matrix(.85,.85),alpha=False).pil_save(str(DEST/f'{kind}-preview.webp'),format='WEBP',quality=94)
 printfile=DEST/f'{kind}-print.html'
 template=(ROOT/'public/tickets/original-1-print.html').read_text(encoding='utf-8')
 start=template.index('<section>');end=template.index('<script>',start)
 sheets=''.join(f'<section><img src="{src}" alt="Page {i}"/></section>' for i,src in enumerate(images,1))
 template=template[:start]+sheets+template[end:]
 template=template.replace('Rectangles illustrés',html.escape(title)).replace('/tickets/original-1.pdf',root+filename+'?v='+version).replace('Arima_Flavors_Separated_Rectangles.pdf',filename).replace('PDF original','Télécharger le PDF')
 printfile.write_text(template,encoding='utf-8')
 paired=any(len(p['sourcePages'])==2 for p in packed[kind])
 description=f'{len(records)} goûts · 4 tickets par goût. '+('2 goûts par page, taille conservée.' if paired else '1 goût par page : les bandelettes occupent toute la hauteur.')
 collections.append({'id':kind,'filename':filename,'title':title,'group':group,'description':description,'pages':len(images),'modelCount':len(records),'ticketsPerPage':8 if paired else 4,'ticketsPerFlavour':4,'flavoursPerPage':2 if paired else 1,'dimensions':dimensions,'pdf':root+filename+'?v='+version,'preview':root+f'{kind}-preview.webp?v='+version,'pageImages':images,'print':root+printfile.name+'?v='+version,'tag':'FORMAT MINI' if kind=='mini-tiramisu' else '2 GOÛTS PAR PAGE' if paired else '4 TICKETS PAR GOÛT'})

registry.write_text(json.dumps(collections,ensure_ascii=False,indent=2),encoding='utf-8')
report={'originalFourTicketBlocksUnscaled':True,'ticketsPerFlavour':4,'illustrated':{'deduplicatedSourcePages':rect_records,'removedDuplicatePages':rect_removed},'tiramisu':{'deduplicatedSourcePages':strip_records,'removedDuplicatePages':strip_removed},'mini':{'sizeMM':[44,27.5],'originalBlockPlacementsMM':mini_positions,'flavours':10,'ticketsPerFlavour':4}}
(AUDIT/'deduplicated-source-pages.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(AUDIT/'two-flavours-validation.json').write_text(json.dumps({'ticketsPerFlavour':4,'collections':packed,'originalSizesPreserved':True},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'collections':[{'id':c['id'],'pages':c['pages'],'flavoursPerPage':c['flavoursPerPage'],'ticketsPerFlavour':4,'dimensions':c['dimensions']} for c in collections],'duplicatePagesRemoved':len(rect_removed)+len(strip_removed),'originalTicketSizesUnchanged':True},ensure_ascii=False))

# Publish the dedicated mini artwork and enlarged design preview on every rebuild.
from prepare_mini_tickets import prepare_mini_collection
prepare_mini_collection()
