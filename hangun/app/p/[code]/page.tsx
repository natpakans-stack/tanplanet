import Link from 'next/link';
import { getProjectByCode } from '@/lib/data';
import { ProjectApp } from '@/components/ProjectApp';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const project = await getProjectByCode(code);

  if (!project) {
    return (
      <div className="center-page">
        <div className="center-card">
          <div className="card card-pad empty">
            <div className="emj">🔍</div>
            <div className="t">ไม่พบ Project นี้</div>
            <div className="s">ลิงก์อาจหมดอายุหรือถูกลบไปแล้ว</div>
            <Link href="/" className="btn btn-secondary" style={{ marginTop: 18 }}>
              กลับหน้าแรก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ProjectApp project={project} />;
}
