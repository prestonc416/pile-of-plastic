import csv
from sqlalchemy import select
from app.db.base import SessionLocal
from app.db.models import Item

def run():
       with open("items.csv", newline="") as csvfile:
           reader = csv.DictReader(csvfile)
           items = []
           with SessionLocal() as db:
               try:
                   for row in reader:
                       slug = row["slug"]
                       item = db.scalar(select(Item).where(Item.slug == slug))
                       if item is None:
                           item = Item(slug=slug)
                       else:
                           print(f"Updating existing item: {slug}")
                       item.figure = row["Figure"]
                       item.brand = row["Brand"]
                       item.line = row["Line"]
                       item.available_at = row["Available at:"]
                       items.append(item)
                   db.bulk_save_objects(items)
                   db.commit()
               finally:
                   db.close()
       print(f"Processed {len(items)} items")

if __name__ == "__main__":
    run()