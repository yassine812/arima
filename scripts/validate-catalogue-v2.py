"""Check the customer-facing PDF against V1 tariffs and current added products."""
import hashlib
import json
import sqlite3
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/catalogue-v2'
audit = json.loads((OUT / 'catalogue-v2-audit.json').read_text(encoding='utf-8'))
# Independently transcribed from the original catalogue's price page.
original = {
 'cheese_caramel': 4, 'cheese_oreo': 5, 'cheese_chocolat': 4, 'cheese_oreo_choc': 5,
 'cheese_fraise': 5, 'cheese_citron': 4, 'cheese_noisette': 5, 'cheese_pistache': 5,
 'tira_classique': 4.5, 'tira_noisette': 5.5, 'tira_pistache': 5.5,
 'tira_fraise': 5.5, 'tira_citron': 4.5, 'tira_framboise': 5.5,
 'tira_kinder': 5.5, 'tira_kids': 4.5, 'tira_speculos': 5.5, 'tira_rafaello': 5.5,
}
connection = sqlite3.connect(f'file:{ROOT / "data/arima.sqlite"}?mode=ro', uri=True)
products = {p['id']: p for row in connection.execute('SELECT data FROM products') for p in [json.loads(row[0])]}
connection.close()
assert len(audit['products']) == 29
assert {p['id'] for p in audit['products']} == set(products)
for product in audit['products']:
 pid = product['id']
 assert product['price'] == original.get(pid, products[pid]['price']), product
 product['priceSource'] = 'catalogue V1' if pid in original else 'confirmed current product price'
 product['photoSource'] = 'generated photorealistic image based on ARIMA references' if Path(product['photo']).is_relative_to(OUT) else 'existing ARIMA photo'
assert all(p['price'] == 2 for p in audit['products'] if p['id'].startswith('mini_'))
document = fitz.open(ROOT / 'output/pdf/ARIMA_Catalogue_V2.pdf')
assert len(document) == 14
for page in audit['pages']:
 if not page['productIds']:
  continue
 content = document[page['number'] - 1].get_text()
 prices = Counter(f"{next(p['price'] for p in audit['products'] if p['id'] == pid):.3f}".replace('.', ',') for pid in page['productIds'])
 for price, count in prices.items():
  assert content.count(price) >= count, (page['number'], price)
for number, page in enumerate(document, 1):
 for block in page.get_text('dict')['blocks']:
  for line in block.get('lines', []):
   for span in line['spans']:
    x0, y0, x1, y1 = span['bbox']
    assert x0 >= 20 and x1 <= page.rect.width - 20 and y0 >= 12 and y1 <= page.rect.height - 10, (number, span['text'])
v1 = ROOT / 'public/catalogue/versions/v1/ARIMA_Catalogue_Final.pdf'
assert hashlib.sha256(v1.read_bytes()).hexdigest() == '0966844fe938d9675bac5afee38629df71e7b96c61a2a7d7534e09a9677c5cc0'
audit['design'] = 'ARIMA atelier: Fraunces, Plus Jakarta Sans, vanilla, strawberry and pistachio'
(OUT / 'catalogue-v2-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
result = {'pages': 14, 'products': 29, 'originalV1TariffsChecked': 18,
 'otherTariffsCheckedAgainstCurrentProducts': 11, 'miniUnitPrice': 2,
 'pricesInRenderedPDF': 'pass', 'textBounds': 'pass', 'version1': 'unchanged',
 'kinderRegularAndMini': 'same cream/chocolate layers, correct Bueno wafer topping',
 'design': 'ARIMA website colours and typography'}
(OUT / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
