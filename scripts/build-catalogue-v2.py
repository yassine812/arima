"""Create the photographic ARIMA edition. This never edits the product database."""
import argparse
import hashlib
import io
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import fitz
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from catalogue_v2_atelier import AtelierDesign

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output' / 'catalogue-v2'
PDF_DIR = ROOT / 'output' / 'pdf'
W, H = A4
PAPER, INK, MUTED = '#F8F5EE', '#392B26', '#84796D'
LINE, SAGE, ROSE = '#DCD5C7', '#69765E', '#914E44'
DATE = datetime.now(ZoneInfo('Africa/Lagos'))
MONTH = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'][DATE.month - 1]
EDITION_DATE = f'{MONTH} {DATE.year}'
PHOTO_FILES = {
 'cheese_caramel':'cheesecake-caramel.png', 'cheese_oreo':'cheesecake-oreo.png',
 'cheese_chocolat':'cheesecake-chocolat.png', 'cheese_oreo_choc':'cheesecake-oreo-chocolat.png',
 'cheese_fraise':'cheesecake-fraise.png', 'cheese_citron':'cheesecake-citron.png',
 'cheese_noisette':'cheesecake-noisette.png', 'cheese_pistache':'cheesecake-pistache.png',
 'cheese_rafaello':'cheesecake-raffaello.png', 'tira_classique':'tiramisu-classique.png',
 'tira_noisette':'tiramisu-noisette-standard.png', 'tira_pistache':'tiramisu-pistache.png',
 'tira_fraise':'tiramisu-fraise.png', 'tira_citron':'tiramisu-citron.png',
 'tira_framboise':'tiramisu-framboise.png', 'tira_kids':'tiramisu-kids.png',
 'tira_speculos':'tiramisu-speculoos.png', 'tira_rafaello':'tiramisu-raffaello.png',
 'mini_tira_noisette':'mini-tiramisu-noisette.png', 'mini_tira_pistache':'mini-tiramisu-pistache.png',
 'mini_tira_framboise':'mini-tiramisu-framboise.png', 'mini_tira_kinder':'mini-tiramisu-kinder-bueno.png',
 'mini_tira_speculos':'mini-tiramisu-speculoos.png', 'mini_tira_rafaello':'mini-tiramisu-raffaello.png',
}
V1_PRICES = {
 'cheese_caramel':4, 'cheese_oreo':5, 'cheese_chocolat':4, 'cheese_oreo_choc':5,
 'cheese_fraise':5, 'cheese_citron':4, 'cheese_noisette':5, 'cheese_pistache':5,
 'tira_classique':4.5, 'tira_noisette':5.5, 'tira_pistache':5.5, 'tira_fraise':5.5,
 'tira_citron':4.5, 'tira_framboise':5.5, 'tira_kinder':5.5, 'tira_kids':4.5,
 'tira_speculos':5.5, 'tira_rafaello':5.5,
}
FLAVOURS = {'caramel':'Caramel','oreo':'Oreo','chocolat':'Chocolat','oreo_choc':'Oreo chocolat',
 'fraise':'Fraise','citron':'Citron','noisette':'Noisette','pistache':'Pistache',
 'rafaello':'Raffaello','classique':'Classique','framboise':'Framboise',
 'kinder':'Kinder Bueno','kids':'Kids','speculos':'Spéculoos'}
DESCRIPTIONS = {
 'cheese_caramel':'Crème onctueuse, biscuit croquant et caramel gourmand.',
 'cheese_oreo':'Le croquant du biscuit Oreo dans une crème toute douce.',
 'cheese_chocolat':'Une crème généreuse sous un nappage chocolat.',
 'cheese_oreo_choc':'Oreo et chocolat : deux fois plus de gourmandise.',
 'cheese_fraise':'Une base biscuitée, une crème douce et un coulis de fraise.',
 'cheese_citron':'Une crème fondante et une touche de citron acidulée.',
 'cheese_noisette':'Le plaisir du praliné et des éclats de noisette.',
 'cheese_pistache':'Crème pistache et éclats croquants sur une base biscuitée.',
 'cheese_rafaello':'Noix de coco, chocolat blanc et une touche de Raffaello.',
 'tira_classique':'Café, mascarpone et voile de cacao. Le plaisir essentiel.',
 'tira_noisette':'Des couches fondantes et un généreux nappage noisette.',
 'tira_pistache':'Une crème pistache et des éclats délicatement croquants.',
 'tira_fraise':'La douceur du mascarpone rencontre le coulis de fraise.',
 'tira_citron':'Une crème citron lumineuse entre deux couches de biscuit.',
 'tira_framboise':'Une touche de framboise acidulée sur une crème douce.',
 'tira_kinder':'Crème douce, chocolat-noisette et gaufrette Kinder Bueno.',
 'tira_kids':'Du chocolat doux et des petites touches de couleur.',
 'tira_speculos':'Le biscuit spéculoos et ses notes chaleureuses.',
 'tira_rafaello':'Un nuage de coco et la douceur du chocolat blanc.',
}


class Catalogue:
 def __init__(self, price_mode):
  OUT.mkdir(parents=True, exist_ok=True); PDF_DIR.mkdir(parents=True, exist_ok=True)
  for name, filename in [('Display','fraunces-400.ttf'),('DisplayItalic','fraunces-400-italic.ttf'),('DisplayBold','fraunces-600.ttf'),('Body','plusjakartasans-400.ttf'),('BodyBold','plusjakartasans-700.ttf')]:
   pdfmetrics.registerFont(TTFont(name, str(OUT/'fonts'/filename)))
  self.product_descriptions=DESCRIPTIONS
  self.edition_date=EDITION_DATE
  self.logo_path=ROOT/'public/brand/arima-logo.jpeg'
  con=sqlite3.connect(f'file:{ROOT / "data/arima.sqlite"}?mode=ro', uri=True)
  self.products={p['id']:p for (data,) in con.execute('SELECT data FROM products') for p in [json.loads(data)]};con.close()
  self.price_mode=price_mode; self.used=[]; self.labels=[]; self.pages=[]; self.cache={}
  self.path=PDF_DIR/'ARIMA_Catalogue_V2.pdf'
  self.c=canvas.Canvas(str(self.path),pagesize=A4,pageCompression=1)
  self.c.setTitle('ARIMA - Catalogue Version 2')
  self.c.setAuthor('Maison ARIMA')
  self.c.setSubject('29 créations : cheesecakes, tiramisus et mini tiramisus - édition photographique')
  self.c.setCreator('Maison ARIMA - Catalogue V2')

 def rect(self,x,y,w,h,color):
  self.c.setFillColor(HexColor(color));self.c.rect(x,H-y-h,w,h,stroke=0,fill=1)

 def rule(self,x,y,w,color=LINE):
  self.c.setStrokeColor(HexColor(color));self.c.setLineWidth(.6);self.c.line(x,H-y,x+w,H-y)

 def text(self,value,x,y,size=11,font='Body',color=INK):
  self.c.setFillColor(HexColor(color));self.c.setFont(font,size);self.c.drawString(x,H-y-size*.84,value)

 def caps(self,value,x,y,size=8,color=MUTED,spacing=1.5):
  self.c.saveState()
  t=self.c.beginText(x,H-y-size*.84);t.setFont('BodyBold',size);t.setCharSpace(spacing);t.setFillColor(HexColor(color));t.textLine(value.upper());self.c.drawText(t)
  self.c.restoreState()

 def para(self,value,x,y,w,size=11,color=MUTED,font='Body',leading=None):
  style=ParagraphStyle('copy',fontName=font,fontSize=size,leading=leading or size*1.5,textColor=HexColor(color))
  p=Paragraph(value,style);_,h=p.wrap(w,600);p.drawOn(self.c,x,H-y-h);return h

 def photo_path(self,pid):
  if pid in ['tira_kinder','mini_tira_kinder']:return OUT/'assets'/f'{pid}-bueno-final.png'
  if pid in PHOTO_FILES:return ROOT/'public/products'/PHOTO_FILES[pid]
  return OUT/'assets'/f'{pid}.png'

 def photo(self,pid,x,y,w,h,focal_y=.60):
  path=self.photo_path(pid)
  if not path.exists():raise FileNotFoundError(path)
  if path not in self.cache:
   im=Image.open(path).convert('RGB');im.thumbnail((1600,1800));buf=io.BytesIO();im.save(buf,format='JPEG',quality=94,subsampling=0);buf.seek(0)
   self.cache[path]=(ImageReader(buf),im.width,im.height)
  image,iw,ih=self.cache[path]
  contain=pid in ['tira_framboise','tira_rafaello','tira_citron','tira_speculos','tira_kids']
  scale=min(w/iw,h/ih) if contain else max(w/iw,h/ih);dw,dh=iw*scale,ih*scale
  dx=x+(w-dw)/2; excess=dh-h; dy=y+(h-dh)/2 if contain else y-max(0,min(excess,dh*focal_y-h/2))
  self.c.saveState();clip=self.c.beginPath();clip.rect(x,H-y-h,w,h);self.c.clipPath(clip,stroke=0)
  self.c.drawImage(image,dx,H-dy-dh,dw,dh,mask='auto');self.c.restoreState()

 def price(self,pid):
  if pid.startswith('mini_'):return 2
  return V1_PRICES.get(pid,self.products[pid]['price']) if self.price_mode=='v1' else self.products[pid]['price']

 def price_text(self,pid):return f'{self.price(pid):.3f}'.replace('.',',')

 def flavour(self,pid):
  for prefix in ['mini_tira_','cheese_','tira_']:
   if pid.startswith(prefix):return FLAVOURS[pid[len(prefix):]]
  raise ValueError(pid)

 def new(self,pid):return pid.startswith('mini_') or pid=='cheese_rafaello'

 def start(self,label,bg=PAPER):
  self.labels.append(label);self.page_products=[];self.rect(0,0,W,H,bg)

 def end(self,dark=False):
  num=len(self.labels);color='#DBCEBB' if dark else MUTED
  self.rule(42,H-42,W-84,'#6D5749' if dark else LINE)
  self.caps('ARIMA / COLLECTION 02',42,H-30,6.7,color,1.1)
  self.text(f'{num:02d}',W-57,H-31,8,color=color)
  self.pages.append({'number':num,'label':self.labels[-1],'productIds':self.page_products})
  self.c.showPage()

 def header(self,family,title,sub,accent=SAGE):
  self.caps('MAISON ARIMA',42,28,7.5,INK)
  self.text('COLLECTION 02',W-129,29,7.5,color=MUTED)
  self.rule(42,51,W-84)
  self.caps(family,42,72,8.5,accent)
  self.text(title,42,94,34,'Display')
  self.para(sub,43,139,W-86,10.5)

 def item(self,pid,x,y,width=511,height=180,reverse=False):
  self.used.append(pid);self.page_products.append(pid)
  photo_w=180 if height<210 else 244
  photo_h=height-10
  photo_x=x+width-photo_w if reverse else x
  self.photo(pid,photo_x,y,photo_w,photo_h)
  tx=x if reverse else x+photo_w+24;tw=width-photo_w-24
  family='MINI TIRAMISU' if pid.startswith('mini_') else ('CHEESECAKE' if pid.startswith('cheese') else 'TIRAMISU')
  self.caps(family,tx,y+12,7,SAGE,1.3)
  title_size=23 if len(self.flavour(pid))<16 else 21
  self.text(self.flavour(pid),tx,y+34,title_size,'Display')
  if self.new(pid):self.caps('NOUVEAU DANS LE CATALOGUE',tx,y+66,6.5,ROSE,.7)
  desc=DESCRIPTIONS.get(pid.replace('mini_',''), 'Un petit format, tout le plaisir de votre saveur préférée.')
  if pid=='mini_tira_kinder':desc='Crème noisette-chocolat et chocolat au lait.'
  self.para(desc,tx,y+(83 if self.new(pid) else 69),tw,10.5)
  self.text(self.price_text(pid),tx,y+height-41,22,'Display')
  self.caps('DT / PIÈCE',tx+79,y+height-32,6.5,MUTED,.8)

 def cover(self):
  self.start('Couverture - Le plaisir à la cuillère')
  self.caps('MAISON',43,33,7,INK,2)
  self.text('ARIMA',41,49,43,'Display')
  self.caps('CATALOGUE / VERSION 2',W-207,43,7,SAGE,1)
  self.text(EDITION_DATE.capitalize(),W-207,61,10,color=MUTED)
  self.rule(43,110,W-86)
  self.text('Le plaisir,',41,138,49,'Display')
  self.text('à la cuillère.',41,195,49,'DisplayItalic',SAGE)
  self.para('29 créations. Trois formats. Une même envie.',44,260,450,11)
  self.photo('tira_kinder',0,307,W,465,.67)
  self.rect(0,772,W,H-772,INK)
  self.caps('TIRAMISUS  /  CHEESECAKES  /  MINI TIRAMISUS',43,797,8,'#FAF3E7',1.15)
  self.pages.append({'number':1,'label':self.labels[-1],'productIds':[]});self.c.showPage()

 def contents(self):
  self.start('La collection - Trois formats, 29 créations')
  self.header('LA COLLECTION','À chacun sa douceur.','Un dessert pour la pause, une saveur pour chaque envie.')
  width=(W-104)/3
  entries=[('cheese_pistache','01','Cheesecakes','9 saveurs','03',SAGE),('tira_noisette','02','Tiramisus','10 saveurs','06',ROSE),('mini_tira_noisette','03','Mini tiramisus','10 saveurs','10',SAGE)]
  for i,(pid,n,title,count,page,color) in enumerate(entries):
   x=42+i*(width+10)
   self.photo(pid,x,205,width,230,.61)
   self.caps(n,x,459,9,color)
   self.text(title,x,480,17,'Display')
   self.text(count,x,510,9,color=MUTED)
   self.rule(x,535,width)
   self.caps(f'À FEUILLETER / P. {page}',x,548,6.2,color,.5)
   self.c.linkAbsolute(f'Aller à {title}',f'page-{int(page)}',Rect=(x,H-574,x+width,H-453),thickness=0)
  self.rect(42,622,W-84,118,'#E8EBDD')
  self.caps('LES NOUVEAUTÉS DE CETTE ÉDITION',61,640,7,SAGE,.9)
  self.text('Coco en cheesecake.',60,661,23,'Display')
  self.text('Dix saveurs en format mini.',60,690,23,'Display')
  self.end()

 def product_page(self,family,title,sub,ids,accent=SAGE):
  self.start(f'{family} - {", ".join(self.flavour(p) for p in ids)}')
  self.c.bookmarkPage(f'page-{len(self.labels)}');self.header(family,title,sub,accent)
  if len(ids)==4:
   # Four mini formats share one airy two-column spread page.
   w=(W-108)/2
   for i,pid in enumerate(ids):
    self.used.append(pid);self.page_products.append(pid);x=42+(i%2)*(w+24);y=185+(i//2)*290
    self.photo(pid,x,y,w,191,.61)
    self.caps('MINI TIRAMISU',x,y+205,6.5,SAGE,1)
    self.text(self.flavour(pid),x,y+222,20,'Display')
    self.text(f'{self.price_text(pid)} DT',x,y+251,12,'BodyBold')
  else:
   step=194 if len(ids)==3 else 292;height=181 if len(ids)==3 else 262
   for i,pid in enumerate(ids):
    y=188+i*step;self.item(pid,42,y,W-84,height,reverse=i%2==1)
    if i<len(ids)-1:self.rule(42,y+step-8,W-84)
  self.end()

 def price_list(self):
  self.start('Tous les prix - Cheesecakes, tiramisus et mini tiramisus')
  self.header('LE CARNET DES PRIX','Choisir son plaisir.','Prix à la pièce, en dinars tunisiens. Toute la collection en un coup d’œil.')
  cats=[('Tiramisus',[p for p in self.used if p.startswith('tira_')]),('Cheesecakes',[p for p in self.used if p.startswith('cheese_')])]
  for col,(title,ids) in enumerate(cats):
   x=42+col*268;wid=243;self.text(title,x,194,25,'Display');self.rule(x,231,wid)
   for i,pid in enumerate(ids):
    y=250+i*29;self.text(self.flavour(pid),x,y,10.5);self.text(self.price_text(pid)+' DT',x+173,y,10,'BodyBold');self.rule(x,y+21,wid,'#E9E3D7')
  self.rect(42,596,W-84,135,'#E8EBDD')
  self.text('Les mini tiramisus',59,615,24,'Display')
  self.text('2,000 DT',W-177,620,23,'Display',SAGE)
  self.para('Classique, noisette, pistache, fraise, citron, framboise,<br/>Kinder Bueno, Kids, spéculoos et Raffaello.',61,658,W-120,11,INK)
  self.caps('10 SAVEURS / PRIX À LA PIÈCE',61,706,6.5,SAGE,.7)
  self.end()

 def back(self):
  self.start('Commander - Contacts Maison ARIMA',INK)
  self.caps('MAISON ARIMA',42,36,8,'#E5D4BB',1.8)
  self.caps('COLLECTION 02',W-145,36,7,'#E5D4BB',1)
  self.text('On garde une place',41,91,37,'Display','#F8F2E7')
  self.text('pour le dessert.',41,139,37,'DisplayItalic','#D5C4A3')
  width=(W-100)/3
  for i,pid in enumerate(['cheese_fraise','tira_kinder','mini_tira_pistache']):self.photo(pid,42+i*(width+8),227,width,205,.62)
  self.caps('UNE ENVIE ? UNE COMMANDE ?',42,470,8,'#D5C4A3',1.2)
  self.text('Parlons gourmandise.',41,495,30,'Display','#F8F2E7')
  self.text('93 171 337',42,550,28,'BodyBold','#F8F2E7')
  self.text('Téléphone & WhatsApp',43,590,10,color='#D5C4A3')
  self.c.linkURL('https://wa.me/21693171337',(42,H-603,300,H-542),relative=0,thickness=0)
  self.rect(W-165,485,122,122,'#F8F2E7')
  qr=QrCodeWidget('https://wa.me/21693171337');b=qr.getBounds();size=106
  drawing=Drawing(size,size,transform=[size/(b[2]-b[0]),0,0,size/(b[3]-b[1]),0,0]);drawing.add(qr);renderPDF.draw(drawing,self.c,W-157,H-599)
  self.caps('COMMANDER',W-144,619,6,'#D5C4A3',1)
  self.rule(42,654,W-84,'#6D5749')
  self.caps('INSTAGRAM / TIKTOK',42,678,6.5,'#D5C4A3',1)
  self.text('@arima_tn',42,699,15,'Body','#F8F2E7')
  self.c.linkURL('https://www.instagram.com/arima_tn/',(42,H-719,220,H-676),relative=0,thickness=0)
  self.caps('FACEBOOK',W-196,678,6.5,'#D5C4A3',1)
  self.text('arima.tn',W-196,699,15,'Body','#F8F2E7')
  self.text(f'Version 2 / {EDITION_DATE.capitalize()}',42,757,9,color='#D5C4A3')
  self.end(dark=True)

 def build(self):
  self.cover();self.contents()
  specs=[
   ('CHEESECAKES','Les essentiels.','Le biscuit, la crème et le plaisir de retrouver ses favoris.',['cheese_caramel','cheese_oreo','cheese_chocolat']),
   ('CHEESECAKES','Frais & croquants.','Des notes de fruits et le caractère de la pistache.',['cheese_fraise','cheese_citron','cheese_pistache']),
   ('CHEESECAKES','Les signatures.','Du croquant, du chocolat et une nouvelle douceur coco.',['cheese_noisette','cheese_oreo_choc','cheese_rafaello']),
   ('TIRAMISUS','Café & biscuit.','Des couches généreuses dans notre format rectangulaire.',['tira_classique','tira_noisette','tira_speculos']),
   ('TIRAMISUS','Fruits en fête.','Trois touches de fraîcheur à savourer à la cuillère.',['tira_fraise','tira_framboise','tira_citron']),
   ('TIRAMISUS','Pistache & coco.','Deux saveurs à découvrir, chacune avec son caractère.',['tira_pistache','tira_rafaello']),
   ('TIRAMISUS','Le goûter rêvé.','Une parenthèse chocolatée, un peu de couleur, beaucoup de plaisir.',['tira_kinder','tira_kids']),
   ('MINI TIRAMISUS','Tout petit, tout bon.','Nouveau : vos saveurs préférées en petit format. 2,000 DT la pièce.',['mini_tira_classique','mini_tira_noisette','mini_tira_pistache','mini_tira_rafaello']),
   ('MINI TIRAMISUS','Une touche de fruit.','Le petit format rencontre la fraise, la framboise et le citron.',['mini_tira_fraise','mini_tira_framboise','mini_tira_citron']),
   ('MINI TIRAMISUS','L’heure du goûter.','Trois mini plaisirs pour varier les envies.',['mini_tira_kinder','mini_tira_kids','mini_tira_speculos']),
  ]
  for i,(family,title,sub,ids) in enumerate(specs):self.product_page(family,title,sub,ids,SAGE if i<3 or i>6 else ROSE)
  self.price_list();self.back();self.c.save()
  if set(self.used)!=set(self.products) or len(self.used)!=len(set(self.used)):raise ValueError('Every database product must appear exactly once in the product pages.')
  data={'edition':2,'pageCount':len(self.labels),'priceMode':self.price_mode,'sourceV1':str(ROOT/'public/catalogue/versions/v1/ARIMA_Catalogue_Final.pdf'),'pages':self.pages,'products':[]}
  for pid in self.used:
   data['products'].append({'id':pid,'name':self.products[pid]['name'],'flavour':self.flavour(pid),'price':self.price(pid),'priceSource':'catalogue V1' if pid in V1_PRICES else 'confirmed current product price','newSinceV1':self.new(pid),'photo':str(self.photo_path(pid)),'photoSource':'generated photorealistic image based on ARIMA references' if self.photo_path(pid).is_relative_to(OUT) else 'existing ARIMA photo'})
  data['sha256']=hashlib.sha256(self.path.read_bytes()).hexdigest();data['pdf']=str(self.path)
  (OUT/'catalogue-v2-audit.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
  (OUT/'page-labels.json').write_text(json.dumps(self.labels,ensure_ascii=False,indent=2),encoding='utf-8')
  doc=fitz.open(self.path)
  if len(doc)!=14:raise ValueError('Expected 14 pages.')
  if len(doc.get_page_images(8))<2:raise ValueError('Missing regular product photographs.')
  for i,page in enumerate(doc):
   page.get_pixmap(matrix=fitz.Matrix(1.35,1.35),alpha=False).save(OUT/f'preview-{i+1:02d}.png')
  doc.close()
  print(json.dumps({'pdf':str(self.path),'pages':len(self.labels),'products':len(self.used),'added':sum(self.new(p) for p in self.used),'priceMode':self.price_mode,'bytes':self.path.stat().st_size},ensure_ascii=False))


class StyledCatalogue(AtelierDesign, Catalogue):
 pass

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--prices',choices=['v1'],default='v1')
 StyledCatalogue(parser.parse_args().prices).build()
