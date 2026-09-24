from pathlib import Path
s=Path('prisma/seed.ts').read_text(encoding='utf-8')
s=s.replace("value:{siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'}","value:JSON.stringify({siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'})")
s=s.replace("create:{key:'general',value:{siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'}}","create:{key:'general',value:JSON.stringify({siteName:'Learnova Suite',currency:'USD',rtl:true,theme:'light'})}")
Path('prisma/seed.ts').write_text(s,encoding='utf-8')
print('seed adjusted for sqlite string json')
