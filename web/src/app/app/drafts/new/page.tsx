import NewDraftClient from "./newDraftClient";

type DraftSearchParams = {
  session?: string | string[];
  q?: string | string[];
};

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<DraftSearchParams>;
}) {
  const params = await searchParams;
  const sessionFromQuery = Array.isArray(params.session) ? (params.session[0] ?? null) : (params.session ?? null);
  const q = Array.isArray(params.q) ? (params.q[0] ?? null) : (params.q ?? null);

  return (
    <NewDraftClient
      sessionFromQuery={sessionFromQuery}
      q={q}
    />
  );
}
