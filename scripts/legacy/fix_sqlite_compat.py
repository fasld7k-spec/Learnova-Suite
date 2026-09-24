from pathlib import Path
s=Path('prisma/schema.prisma').read_text(encoding='utf-8')
# remove enum blocks
import re
s=re.sub(r'enum\s+\w+\s*\{[^}]*\}\s*','',s,flags=re.S)
repls={
 'role         Role           @default(STUDENT)':'role         String         @default("STUDENT")',
 'status       ApprovalStatus @default(APPROVED)':'status       String         @default("APPROVED")',
 'status           CourseStatus @default(PENDING)':'status           String       @default("PENDING")',
 'type            LessonType       @default(VIDEO)':'type            String       @default("VIDEO")',
 'provider        LiveProvider':'provider        String',
 'status        PaymentStatus @default(PENDING)':'status        String @default("PENDING")',
 'status       WithdrawalStatus @default(PENDING)':'status       String @default("PENDING")',
 'requirements     Json':'requirements     String @default("[]")',
 'outcomes         Json':'outcomes         String @default("[]")',
 'metadata      Json?':'metadata      String?',
 'value     Json':'value     String',
 'config       Json?':'config       String?',
 'payload   Json':'payload   String',
 'features      Json':'features      String @default("[]")'
}
for a,b in repls.items(): s=s.replace(a,b)
Path('prisma/schema.prisma').write_text(s,encoding='utf-8')
print('sqlite schema enum/json converted')
