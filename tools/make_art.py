from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

root = Path('/root/tft-kimi')
source = Image.open(root / 'data/hachimi-original.png').convert('RGB')
cat = ImageOps.fit(source, (512, 512), centering=(0.5, 0.40))
art = root / 'android/assets/art'
art.mkdir(parents=True, exist_ok=True)
cat.save(art / 'hachimi.png', optimize=True)
background = Image.new('RGB', (1080, 1920), '#eee5d5')
portrait = ImageOps.fit(source, (1080, 1300), centering=(0.5, 0.35))
background.paste(portrait, (0, 240))
background = background.filter(ImageFilter.GaussianBlur(3))
wash = Image.new('RGB', background.size, '#f4eee0')
Image.blend(background, wash, 0.38).save(art / 'hachimi-background.webp', quality=90)
canvas = Image.new('RGB', (512, 512), '#e8d8bc')
canvas.paste(ImageOps.fit(cat, (414, 414)), (49, 49))
for qualifier, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    target = root / ('android/res/mipmap-' + qualifier)
    target.mkdir(parents=True, exist_ok=True)
    canvas.resize((size,size),Image.Resampling.LANCZOS).save(target / 'ic_launcher.png')
webart = root / 'frontend/apps/react/public/art'
webart.mkdir(parents=True, exist_ok=True)
for file in art.iterdir():
    (webart / file.name).write_bytes(file.read_bytes())
print('Hachimi source', source.size, '; icon/background generated')
