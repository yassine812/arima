"""Printable ARIMA atelier styling: photographic desserts, playful paper graphics."""
import math
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

W, H = 595.2755905511812, 841.8897637795277
CREAM, INK, MUTED = '#FFF9EF', '#513A33', '#927366'
ROSE, PINK, PISTACHE, COCOA = '#C37F79', '#F8E0D9', '#E7EDDA', '#754E43'
TINTS = {
 'caramel':'#F8E4C7','oreo':'#E9E3DA','chocolat':'#ECD8CE','oreo_choc':'#EBDCD1',
 'fraise':'#F8DEDA','framboise':'#F6DCE4','citron':'#F6EDCA','noisette':'#F2E0CA',
 'pistache':'#E7EDDA','rafaello':'#F2EBDD','classique':'#EEDFD2','kinder':'#F5E3D4',
 'kids':'#F5DCD9','speculos':'#EEDAC6',
}


class AtelierDesign:
 def tint(self,pid):
  for prefix in ['mini_tira_','cheese_','tira_']:
   if pid.startswith(prefix):return TINTS[pid[len(prefix):]]

 def rounded(self,x,y,w,h,r,fill,stroke=None,shadow=False):
  if shadow:
   self.c.setFillColor(HexColor('#E6CFBC'));self.c.roundRect(x,H-y-h-4,w,h,r,fill=1,stroke=0)
  self.c.setFillColor(HexColor(fill));self.c.setStrokeColor(HexColor(stroke or fill));self.c.setLineWidth(.7)
  self.c.roundRect(x,H-y-h,w,h,r,fill=1,stroke=bool(stroke))

 def star(self,x,y,r=9,color=ROSE):
  p=self.c.beginPath();p.moveTo(x,H-y+r)
  for px,py in [(x+r*.26,y-r*.26),(x+r,y),(x+r*.26,y+r*.26),(x,y+r),(x-r*.26,y+r*.26),(x-r,y),(x-r*.26,y-r*.26)]:p.lineTo(px,H-py)
  p.close();self.c.setFillColor(HexColor(color));self.c.drawPath(p,fill=1,stroke=0)

 def dots(self):
  self.c.setFillColor(HexColor('#EAD9C5'))
  for x in range(16,590,24):
   for y in range(16,840,24):self.c.circle(x,H-y,.48,fill=1,stroke=0)

 def centre(self,value,y,size=24,font='Display',color=INK):
  from reportlab.pdfbase import pdfmetrics
  width=pdfmetrics.stringWidth(value,font,size);self.text(value,(W-width)/2,y,size,font,color)

 def small_pill(self,text,x,y,width,fill=CREAM,color=COCOA):
  self.rounded(x,y,width,23,11.5,fill)
  from reportlab.pdfbase import pdfmetrics
  tw=pdfmetrics.stringWidth(text,'BodyBold',7)
  self.text(text,x+(width-tw)/2,y+8,7,'BodyBold',color)

 def price_badge(self,pid,x,y,angle=-4):
  self.c.saveState();self.c.translate(x,H-y);self.c.rotate(angle)
  self.c.setFillColor(HexColor('#DDBDA2'));self.c.roundRect(0,-35,105,33,12,fill=1,stroke=0)
  self.c.setFillColor(HexColor(CREAM));self.c.setStrokeColor(HexColor('#D6AF91'));self.c.setLineWidth(.8);self.c.roundRect(0,-32,105,33,12,fill=1,stroke=1)
  self.c.setFillColor(HexColor(COCOA));self.c.setFont('Display',18);self.c.drawString(12,-20,self.price_text(pid))
  self.c.setFont('BodyBold',7);self.c.drawString(82,-18,'DT')
  self.c.restoreState()

 def photo_window(self,pid,x,y,w,h,r=28):
  self.c.saveState();path=self.c.beginPath();path.roundRect(x,H-y-h,w,h,r);self.c.clipPath(path,stroke=0)
  self.rect(x,y,w,h,'#FFFDFA');self.photo(pid,x,y,w,h,.58);self.c.restoreState()

 def start(self,label,bg=CREAM):
  self.labels.append(label);self.page_products=[];self.rect(0,0,W,H,bg);self.dots()

 def end(self,dark=False):
  number=len(self.labels)
  self.small_pill('MAISON ARIMA / COLLECTION 02',30,H-35,181,'#F5E8D8',MUTED)
  self.rounded(W-56,H-35,26,23,11.5,PISTACHE)
  self.text(f'{number:02d}',W-49,H-28,8,'BodyBold',COCOA)
  self.pages.append({'number':number,'label':self.labels[-1],'productIds':self.page_products});self.c.showPage()

 def header(self,family,title,sub,accent=None):
  self.caps('LA MAISON ARIMA',31,27,7.4,COCOA,1.4)
  self.small_pill('VERSION 2',W-112,18,82,PINK)
  self.small_pill(family,30,62,145,PISTACHE if family.startswith('MINI') or family=='CHEESECAKES' else PINK)
  self.text(title,29,100,37,'Display',INK)
  self.para(sub,31,146,W-100,10,MUTED)
  self.star(W-46,111,9,'#D1AB76');self.star(W-63,91,4,ROSE)

 def family_label(self,pid):
  return 'MINI TIRAMISU' if pid.startswith('mini') else 'CHEESECAKE' if pid.startswith('cheese') else 'TIRAMISU'

 def remember(self,pid):self.used.append(pid);self.page_products.append(pid)

 def description(self,pid):
  # The builder supplies the source descriptions as data, without restyling photos.
  return self.product_descriptions.get(pid.replace('mini_',''),'Une petite douceur à savourer.')

 def feature_card(self,pid,x,y,w=535,h=245):
  self.remember(pid);self.rounded(x,y,w,h,29,self.tint(pid),shadow=True)
  self.photo_window(pid,x+12,y+12,235,h-24,25)
  tx=x+267
  self.caps(self.family_label(pid),tx,y+25,6.7,COCOA,1)
  self.text(self.flavour(pid),tx,y+50,27 if len(self.flavour(pid))<14 else 23,'Display',INK)
  self.para(self.description(pid),tx,y+89,w-287,10,COCOA,leading=15)
  if self.new(pid):self.small_pill('NOUVEAUTÉ',tx,y+143,92,CREAM,ROSE)
  self.price_badge(pid,tx,y+h-62,-3)
  self.star(x+w-27,y+h-24,5,ROSE)

 def small_card(self,pid,x,y,w=258,h=301):
  self.remember(pid);self.rounded(x,y,w,h,26,self.tint(pid),shadow=True)
  compact=h<290
  self.photo_window(pid,x+10,y+10,w-20,166 if compact else 185,24)
  self.caps(self.family_label(pid),x+17,y+(187 if compact else 208),6.2,COCOA,.8)
  self.text(self.flavour(pid),x+16,y+(204 if compact else 226),23 if len(self.flavour(pid))<16 else 21,'Display',INK)
  self.price_badge(pid,x+16,y+(239 if compact else 263),-2)
  if self.new(pid):self.small_pill('NOUVEAU',x+w-90,y+(243 if compact else 267),76,CREAM,ROSE)

 def tall_card(self,pid,x,y,w=258,h=545):
  self.remember(pid);self.rounded(x,y,w,h,32,self.tint(pid),shadow=True)
  self.photo_window(pid,x+12,y+12,w-24,320,28)
  self.caps(self.family_label(pid),x+20,y+355,7,COCOA,.9)
  self.text(self.flavour(pid),x+19,y+379,25 if len(self.flavour(pid))<14 else 23,'Display',INK)
  self.para(self.description(pid),x+21,y+422,w-42,10,COCOA)
  self.price_badge(pid,x+20,y+h-59,-4)
  self.star(x+w-31,y+h-28,8,ROSE)

 def cover(self):
  self.start('Couverture - Les petites douceurs de la Maison')
  # The same vanilla, strawberry and pistachio palette as the website.
  self.c.setFillColor(HexColor(PINK));self.c.ellipse(-110,H-735,530,H-225,fill=1,stroke=0)
  self.c.setFillColor(HexColor(PISTACHE));self.c.ellipse(320,H-725,720,H-360,fill=1,stroke=0)
  self.small_pill('LA COLLECTION / VERSION 2',30,24,185,PINK)
  self.text(self.edition_date.capitalize(),W-142,32,9,'BodyBold',MUTED)
  # Use the owner's actual logo, on a small paper label.
  self.rounded(215,66,166,91,25,'#F1EBD9',stroke='#E6D6BE')
  self.c.drawImage(str(self.logo_path),220,H-151,156,85,preserveAspectRatio=True,anchor='c',mask='auto')
  self.centre('Nos petites',179,52,'Display',INK)
  self.centre('douceurs.',234,58,'DisplayItalic',ROSE)
  self.centre('De la crème, du croquant et beaucoup d’amour.',306,11,'Body',COCOA)
  self.star(57,217,12,'#B58C60');self.star(531,259,10,'#A8B77F');self.star(504,193,6,ROSE)
  # A tactile collage of real photographic products, rather than a page of rows.
  for pid,cx,cy,ww,hh,angle in [('cheese_pistache',133,505,198,267,7),('tira_kinder',310,523,244,314,-4),('mini_tira_kinder',478,545,170,228,-9)]:
   self.c.saveState();self.c.translate(cx,H-cy);self.c.rotate(angle);self.c.translate(-ww/2,-hh/2)
   self.c.setFillColor(HexColor('#DFC6B3'));self.c.roundRect(2,-4,ww,hh,22,fill=1,stroke=0)
   self.c.setFillColor(HexColor('#FFFDF8'));self.c.roundRect(0,0,ww,hh,22,fill=1,stroke=0)
   clip=self.c.beginPath();clip.roundRect(9,10,ww-18,hh-20,16);self.c.clipPath(clip,stroke=0)
   image=self.cache_image(pid);iw,ih=image.getSize();fw,fh=ww-18,hh-20
   scale=max(fw/iw,fh/ih)*1.25;dw,dh=iw*scale,ih*scale
   self.c.drawImage(image,9+(fw-dw)/2,10+fh/2-dh*.4,dw,dh,mask='auto');self.c.restoreState()
  self.small_pill('29 CRÉATIONS À SAVOURER',39,691,186,CREAM,COCOA)
  self.small_pill('10 MINI TIRAMISUS',354,707,182,PISTACHE,COCOA)
  self.centre('Cheesecakes. Tiramisus. Petits plaisirs.',758,13,'Display',COCOA)
  self.caps('LA TOUCHE ARIMA / À CHAQUE CUILLÈRE',125,800,7.4,MUTED,1.1)
  self.pages.append({'number':1,'label':self.labels[-1],'productIds':[]});self.c.showPage()

 def cache_image(self,pid):
  from reportlab.lib.utils import ImageReader
  from PIL import Image
  import io
  path=self.photo_path(pid)
  if path not in self.cache:
   im=Image.open(path).convert('RGB');im.thumbnail((1600,1800));buf=io.BytesIO();im.save(buf,format='JPEG',quality=94,subsampling=0);buf.seek(0)
   self.cache[path]=(ImageReader(buf),im.width,im.height)
  return self.cache[path][0]

 def contents(self):
  self.start('Notre collection - Cheesecakes, tiramisus et minis')
  self.header('LE CARNET GOURMAND','Une envie, trois formats.','Choisissez votre douceur. Le reste, c’est une histoire de goût.')
  families=[('cheese_oreo','Les cheesecakes','9 saveurs','03',PINK),('tira_noisette','Les tiramisus','10 saveurs','06','#F9EAD7'),('mini_tira_pistache','Les mini tiramisus','10 saveurs / 2,000 DT','10',PISTACHE)]
  for i,(pid,title,count,page,color) in enumerate(families):
   x=30;y=197+i*187;self.rounded(x,y,W-60,165,28,color,shadow=True);self.photo_window(pid,x+10,y+10,160,145,25)
   self.caps(f'CHAPITRE 0{i+1}',216,y+23,7,COCOA,1.2);self.text(title,214,y+48,27,'Display',INK)
   self.text(count,217,y+91,11,'BodyBold',COCOA);self.small_pill(f'FEUILLETER / P. {page}',216,y+119,166,CREAM)
   self.c.linkAbsolute(title,f'page-{int(page)}',Rect=(x,H-y-165,x+W-60,H-y),thickness=0)
  self.star(539,761,8,ROSE);self.end()

 def product_page(self,family,title,sub,ids,accent=None):
  self.start(f'{family} - {", ".join(self.flavour(p) for p in ids)}');self.c.bookmarkPage(f'page-{len(self.labels)}')
  self.header(family,title,sub)
  if len(ids)==3:
   self.feature_card(ids[0],30,198,W-60,245)
   self.small_card(ids[1],30,469,258,301);self.small_card(ids[2],307,469,258,301)
  elif len(ids)==2:
   self.tall_card(ids[0],30,199,258,547);self.tall_card(ids[1],307,228,258,547)
  else:
   for i,pid in enumerate(ids):self.small_card(pid,30+(i%2)*277,197+(i//2)*292,258,276)
  self.end()

 def price_list(self):
  self.start('Les prix de la Maison - Tous les tarifs')
  self.header('LES PRIX DE LA MAISON','À chaque envie, son plaisir.','Prix à la pièce, en dinars tunisiens.')
  groups=[('Les tiramisus',[p for p in self.used if p.startswith('tira_')],PINK),('Les cheesecakes',[p for p in self.used if p.startswith('cheese_')],PISTACHE)]
  for j,(title,ids,tint) in enumerate(groups):
   x=30+j*277;self.rounded(x,197,258,407,26,tint,shadow=True);self.text(title,x+17,218,23,'Display',INK)
   self.small_pill('LA PIÈCE / DT',x+17,252,118,CREAM)
   for i,pid in enumerate(ids):
    y=296+i*28;self.text(self.flavour(pid),x+17,y,10,'Body',INK);self.text(self.price_text(pid),x+191,y,11,'BodyBold',COCOA)
    if i<len(ids)-1:self.rule(x+17,y+19,224,'#D8C5B3')
  self.rounded(30,631,W-60,140,28,'#F9EAD7',shadow=True)
  self.text('Les minis, maxi plaisir.',49,652,29,'Display',INK)
  self.price_badge('mini_tira_classique',W-163,650,-4)
  self.para('Classique, noisette, pistache, fraise, citron, framboise,<br/>Kinder Bueno, Kids, spéculoos et Raffaello.',51,699,W-106,10.3,COCOA)
  self.caps('10 SAVEURS / À LA PIÈCE',51,751,6.8,MUTED,1)
  self.end()

 def back(self):
  self.start('On se garde une douceur ? - Contacts ARIMA')
  self.c.setFillColor(HexColor(PINK));self.c.ellipse(-150,H-480,720,H+180,fill=1,stroke=0)
  self.small_pill('UN PEU DE DOUCEUR, BEAUCOUP DE SOIN',30,30,286,CREAM)
  self.text('On se garde',30,100,49,'Display',INK);self.text('une douceur ?',30,158,49,'DisplayItalic',ROSE)
  self.star(527,120,15,'#A8B77F')
  self.rounded(30,270,325,445,35,'#F9EAD7',shadow=True);self.photo_window('tira_kinder',43,283,299,283,29)
  self.text('On en parle ?',50,590,33,'Display',INK)
  self.text('93 171 337',51,640,27,'BodyBold',COCOA)
  self.text('Téléphone & WhatsApp',53,680,10,'Body',MUTED)
  self.c.linkURL('https://wa.me/21693171337',(43,H-704,340,H-587),relative=0,thickness=0)
  self.rounded(378,308,187,201,29,PISTACHE,shadow=True)
  self.small_pill('ÉCRIVEZ-NOUS',397,324,149,CREAM)
  qr=QrCodeWidget('https://wa.me/21693171337');b=qr.getBounds();size=141
  self.rounded(400,360,143,133,18,'#FFFFFF')
  drawing=Drawing(size,size,transform=[size/(b[2]-b[0]),0,0,size/(b[3]-b[1]),0,0]);drawing.add(qr);renderPDF.draw(drawing,self.c,401,H-500)
  self.small_pill('INSTAGRAM / TIKTOK',378,550,187,PINK)
  self.text('@arima_tn',391,589,20,'Display',INK)
  self.small_pill('FACEBOOK',378,637,187,PINK)
  self.text('arima.tn',391,675,20,'Display',INK)
  self.c.linkURL('https://www.instagram.com/arima_tn/',(378,H-619,565,H-550),relative=0,thickness=0)
  self.centre('La touche ARIMA. Tout simplement.',752,19,'DisplayItalic',COCOA)
  self.end()
