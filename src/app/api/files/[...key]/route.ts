import { getCurrentAdmin } from "@/lib/auth";
import { getAttachment } from "@/lib/object-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!(await getCurrentAdmin())) return new Response("Unauthorized", { status: 401 });
  const { key } = await params;
  try {
    const object = await getAttachment(key.join("/"));
    if (!object.Body) return new Response("Not found", { status: 404 });
    const originalName = decodeURIComponent(object.Metadata?.originalname ?? key.at(-1) ?? "attachment");
    return new Response(object.Body.transformToWebStream(), { headers: { "Content-Type": object.ContentType ?? "application/octet-stream", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`, "Cache-Control": "private, max-age=60" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
