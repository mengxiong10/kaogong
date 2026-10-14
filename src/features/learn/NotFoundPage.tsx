import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="px-[25px] py-[65px] [&>h1]:text-[21px] [&>h1]:font-semibold [&>p:not(.eyebrow)]:mt-3 [&>p:not(.eyebrow)]:mb-6 [&>p:not(.eyebrow)]:text-[13px] [&>p:not(.eyebrow)]:text-muted-foreground">
      <p className="mb-2.5 text-[10px] font-medium tracking-[1.4px] text-muted-foreground">
        404
      </p>
      <h1>没有找到这个页面</h1>
      <p>返回知识体系，选择一个学习模块。</p>
      <Button className="min-h-11" asChild>
        <Link to="/learn">返回知识体系</Link>
      </Button>
    </div>
  );
}
