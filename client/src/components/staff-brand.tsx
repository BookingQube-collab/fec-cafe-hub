import e3Icon from '@/assets/brand/e3-icon.svg';
import e3WordmarkDark from '@/assets/brand/e3-wordmark-dark.svg';
import e3WordmarkLight from '@/assets/brand/e3-wordmark-light.svg';

export function StaffBrand({ compact = false }: { compact?: boolean }) {
  return <div className={'staff-brand' + (compact ? ' is-compact' : '')}>
    {compact ? <>
      <img className="staff-brand-icon" src={e3Icon} alt="E3" width="49" height="35"/>
      <span><strong>CAFÉ OPERATIONS</strong><small>One workspace. Every café.</small></span>
    </> : <>
      <img className="staff-brand-wordmark for-dark" src={e3WordmarkDark} alt="E3 Events & Entertainment Enterprises" width="285" height="66"/>
      <img className="staff-brand-wordmark for-light" src={e3WordmarkLight} alt="E3 Events & Entertainment Enterprises" width="285" height="66"/>
      <span className="staff-brand-caption">Café operations</span>
    </>}
  </div>;
}
