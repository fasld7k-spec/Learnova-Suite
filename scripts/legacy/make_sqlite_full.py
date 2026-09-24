from pathlib import Path
import re
src = Path('prisma/schema.postgres.prisma').read_text(encoding='utf-8')
# provider sqlite
src = re.sub(r'datasource db \{\s*provider\s*=\s*"postgresql"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}', 'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}', src, flags=re.S)
# collect enum names and values
enums = {}
for m in re.finditer(r'enum\s+(\w+)\s*\{([^}]*)\}', src, flags=re.S):
    vals = [v.strip() for v in m.group(2).split() if v.strip() and not v.strip().startswith('//')]
    enums[m.group(1)] = vals
# remove enums
src = re.sub(r'enum\s+\w+\s*\{[^}]*\}\s*', '', src, flags=re.S)
# scalar lists -> String with default []
src = re.sub(r'(\s+\w+\s+)String\[\](\s*(?:@[^\n]*)?)', lambda m: m.group(1)+'String'+((' @default("[]")' if '@default' not in m.group(2) else '') )+m.group(2), src)
# Json -> String
src = re.sub(r'\bJson\?', 'String?', src)
src = re.sub(r'\bJson\b', 'String', src)
# enum field types -> String and quote defaults
for enum_name, vals in enums.items():
    src = re.sub(rf'\b{enum_name}\b', 'String', src)
    for val in vals:
        src = src.replace(f'@default({val})', f'@default("{val}")')
# fix unsupported indexes? SQLite supports indexes. Decimal supported.
# remove unsupported array defaults artifacts if any double spaces okay
Path('prisma/schema.prisma').write_text(src, encoding='utf-8')
print('converted full postgres schema to sqlite-compatible schema with models:', src.count('model '))
