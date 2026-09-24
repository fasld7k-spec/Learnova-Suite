export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'green' | 'yellow' | 'red' | 'blue' | 'slate' }) {
  const map = {
    green: 'border-[#00BA7C]/60 bg-[#00BA7C]/10 text-[#5EE4B3]',
    yellow: 'border-[#FFD400]/60 bg-[#FFD400]/10 text-[#FFE36E]',
    red: 'border-[#F4212E]/60 bg-[#F4212E]/10 text-[#FF7A83]',
    blue: 'border-[#1D9BF0]/60 bg-[#1D9BF0]/10 text-[#79C7FF]',
    slate: 'border-[#2A3037] bg-[#101317] text-[#D7DEE4]'
  };

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black leading-none ${map[tone]}`}>{children}</span>;
}
