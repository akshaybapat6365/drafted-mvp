import NewDraftClient from "./newDraftClient";

export default function NewDraftPage({
  searchParams,
}: {
  searchParams: { session?: string; q?: string };
}) {
  return (
    <NewDraftClient
      sessionFromQuery={searchParams.session ?? null}
      q={searchParams.q ?? null}
    />
  );
}

