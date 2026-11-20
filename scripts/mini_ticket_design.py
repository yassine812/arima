"""Original mini-tiramisu label design, drawn at its actual 44 x 27.5 mm size."""
import json
import sqlite3
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parent.parent
MM=72/25.4
W,H=44*MM,27.5*MM
for name,file in [('MiniDisplay','georgiab.ttf'),('MiniBody','arial.ttf'),('MiniBold','arialbd.ttf')]:
 if name not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))

FLAVOURS={
 'classique':('Classique','coffee','#EBD4BF','#996D50'),
 'noisette':('Noisette','hazelnut','#EBD7BA','#9B7747'),
 'pistache':('Pistache','pistachio','#E2EBCB','#778B4E'),
 'fraise':('Fraise','strawberry','#F7DCD7','#BE776C'),
 'citron':('Citron','lemon','#F6EDBB','#A28D3B'),
 'framboise':('Framboise','raspberry','#F0D5DE','#AF687D'),
 'kinder':('Kinder Bueno','chocolate','#F1DECC','#A77655'),
 'kids':('Kids','chocolate','#E4E7F3','#8A86A3'),
 'speculos':('Spéculoos','speculos','#EED4B8','#AB7B47'),
 'rafaello':('Raffaello','coconut','#EEE8D7','#A18B66'),
}
ART_DIRECTORY=ROOT/'public/tickets/mini-design-v3'
ART_SPECS=json.loads((ART_DIRECTORY/'artwork.json').read_text(encoding='utf-8'))
ARTWORK={key:ImageReader(str(ART_DIRECTORY/spec['file'])) for key,spec in ART_SPECS.items()}

def mini_flavours():
 db=sqlite3.connect(f'file:{ROOT/"data/arima.sqlite"}?mode=ro',uri=True)
 products=[json.loads(row[0]) for row in db.execute('SELECT data FROM products')]
 db.close()
 result=[]
 for p in products:
  if p['category']!='Mini tiramisus':continue
  key=p['id'].removeprefix('mini_tira_')
  if key not in FLAVOURS:raise ValueError('Unknown mini flavour: '+key)
  name,glyph,tint,accent=FLAVOURS[key]
  result.append({'id':key,'name':name,'glyph':glyph,'tint':ART_SPECS[key]['panel'],'accent':accent,'ink':ART_SPECS[key]['ink'],'productId':p['id']})
 assert len(result)==10 and len({p['id'] for p in result})==10
 return result

def label(c,flavour):
 """Ten independently generated scenes, with native-size vector typography."""
 c.saveState()
 path=c.beginPath();path.roundRect(0,0,W,H,4);c.clipPath(path,stroke=0)
 c.setFillColor(HexColor(flavour['tint']));c.rect(0,0,W,H,fill=1,stroke=0)
 art=ARTWORK[flavour['id']];iw,ih=art.getSize()
 scale=max(W/iw,H/ih);dw,dh=iw*scale,ih*scale
 c.drawImage(art,(W-dw)/2,(H-dh)/2,dw,dh)
 # The generation reserves this region for crisp, readable type.
 x=72;available=W-x-6
 c.setFillColor(HexColor(flavour['ink']));c.setFont('MiniDisplay',9.5);c.drawString(x,H-16,'ARIMA')
 c.setFont('MiniBold',5.3);c.drawString(x,H-29,'MINI TIRAMISU')
 c.setStrokeColor(HexColor(flavour['ink']));c.setStrokeAlpha(.55);c.setLineWidth(.45);c.line(x,H-34,W-7,H-34);c.setStrokeAlpha(1)
 name=flavour['name'];size=12.5
 if name=='Kinder Bueno':lines=['Kinder','Bueno']
 else:lines=[name]
 while max(pdfmetrics.stringWidth(line,'MiniDisplay',size) for line in lines)>available:size-=.25
 c.setFont('MiniDisplay',size)
 for i,line in enumerate(lines):c.drawString(x,31-i*12 if len(lines)>1 else 24,line)
 c.setFont('MiniBody',5.1);c.drawString(x,7.5,'@arima_tn')
 c.restoreState()
 c.setStrokeColor(HexColor(flavour['ink']));c.setStrokeAlpha(.6);c.setLineWidth(.4);c.roundRect(1,1,W-2,H-2,4,fill=0,stroke=1);c.setStrokeAlpha(1)

def build_mini_pages(destination,paired=False):
 flavours=mini_flavours()
 c=canvas.Canvas(str(destination),pagesize=(210*MM,297*MM),pageCompression=1)
 c.setTitle('ARIMA - Mini tiramisus - Nouveau design - 44 x 27,5 mm')
 c.setAuthor('Maison ARIMA')
 step=2 if paired else 1
 placements=[]
 for start in range(0,len(flavours),step):
  groups=flavours[start:start+step]
  for group,flavour in enumerate(groups):
   for row in range(2):
    for col in range(2):
     x=61+col*44;y=27.5+group*67+row*27.5
     c.saveState();c.translate(x*MM,(297-y-27.5)*MM);label(c,flavour);c.restoreState()
     placements.append({'page':start//step+1,'flavour':flavour['id'],'xMM':x,'yMM':y,'widthMM':44,'heightMM':27.5})
  c.showPage()
 c.save()
 return flavours,placements

def build_label_samples(directory):
 directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
 for flavour in mini_flavours():
  c=canvas.Canvas(str(directory/f"label-{flavour['id']}.pdf"),pagesize=(W,H),pageCompression=1)
  c.setTitle('ARIMA - Mini tiramisu '+flavour['name']);label(c,flavour);c.showPage();c.save()

def build_design_overview(destination):
 """Enlarged contact sheet for design review, separate from print-size stickers."""
 c=canvas.Canvas(str(destination),pagesize=(210*MM,297*MM),pageCompression=1)
 c.setTitle('ARIMA - Aperçu des dix illustrations mini')
 for index,flavour in enumerate(mini_flavours()):
  x=21.8+(index%2)*87.2;y=12.75+(index//2)*55.5
  c.saveState();c.translate(x*MM,(297-y-49.5)*MM);c.scale(1.8,1.8);label(c,flavour);c.restoreState()
 c.showPage();c.save()
